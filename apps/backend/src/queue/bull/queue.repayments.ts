import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { periodLabel, type Period } from '@microbuilt/shared';
import { Prisma, type PaymentInflowState } from '@prisma/client';
import type { Job } from 'bull';
import { captureJobError } from 'src/common/observability';
import {
  payrollUploadPath,
  readPayrollSheet,
  type PayrollDetails,
  type PayrollRow,
} from 'src/common/logic/repayment-validation';
import { QueueName, RepaymentQueueName, type PayrollUploadJob } from 'src/common/types/queue.interface';
import {
  PAYROLL_UPLOADS_BUCKET,
  type PayrollRowOutcome,
  type PayrollUploadSummary,
} from 'src/common/types/repayment.interface';
import { chunkArray, formatCurrency } from 'src/common/utils';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { LedgerTx, type Tx } from 'src/ledger/ledger.tx';
import { money, toNumber, ZERO, type Money } from 'src/ledger/money';
import { CustomerNotifierService } from 'src/notifications/customer-notifier.service';
import { InappService } from 'src/notifications/inapp.service';
import { ADMIN_LINKS } from 'src/notifications/admin-notifier.service';

/** The admin app's repayments page. */
/** Unexpected row failures sent to Sentry per job: an outage fails every row the same way. */
const REPORTED_ERRORS = 5;
/** Staff IDs looked up per query. */
const LOOKUP_CHUNK = 1000;

interface RowResult {
  outcome: PayrollRowOutcome;
  customerId?: string;
  /** What reached the loan, and what was paid beyond it (to refund). */
  applied?: Money;
  unapplied?: Money;
}

/** CustomerPayroll fields from the row, only where the sheet has a value (V2.MD §0.5). */
function payrollUpdate(payroll: PayrollDetails): Prisma.CustomerPayrollUpdateManyMutationInput {
  return {
    ...(payroll.grade && { grade: payroll.grade }),
    ...(payroll.step > 0 && { step: payroll.step }),
    ...(payroll.command && { command: payroll.command }),
    ...(payroll.organization && { organization: payroll.organization }),
    ...(payroll.employeeGross > 0 && { employeeGross: money(payroll.employeeGross) }),
    ...(payroll.netPay > 0 && { netPay: money(payroll.netPay) }),
  };
}

function isDuplicateRow(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// A payroll upload, row by row (V2.MD §0.5 "Payroll row"). Each row is its own transaction: the
// PAYROLL inflow, the CustomerPayroll update and the allocation commit together or not at all.
// The partial unique index on (externalUserId, periodId) makes a row already imported fail with
// P2002, so it is skipped as a duplicate and running the job again is safe.
@Processor(QueueName.repayments)
export class RepaymentsConsumer {
  private readonly logger = new Logger(RepaymentsConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly ledgerTx: LedgerTx,
    private readonly ledger: LedgerService,
    private readonly notifier: CustomerNotifierService,
    private readonly inapp: InappService,
  ) {}

  @Process(RepaymentQueueName.process_payroll_upload)
  async processUpload(job: Job<PayrollUploadJob>): Promise<PayrollUploadSummary> {
    const upload = await this.prisma.payrollUpload.findUnique({
      where: { id: job.data.uploadId },
      select: {
        id: true,
        fileHash: true,
        periodId: true,
        uploadedById: true,
        period: { select: { year: true, month: true } },
      },
    });
    if (!upload) throw new Error(`Payroll upload ${job.data.uploadId} not found`);
    const period: Period = upload.period;
    const label = periodLabel(period);

    const file = await this.supabase.downloadPrivate(PAYROLL_UPLOADS_BUCKET, payrollUploadPath(period, upload.fileHash));
    const { missingColumns, rows } = readPayrollSheet(file);
    if (missingColumns.length) throw new Error(`The stored sheet is missing columns: ${missingColumns.join(', ')}`);
    const customers = await this.customersByStaffId(rows.map((row) => row.staffId).filter(Boolean));

    const summary: PayrollUploadSummary = {
      uploadId: upload.id,
      period: label,
      rows: rows.length,
      settled: 0,
      reviewing: 0,
      unmatched: 0,
      duplicate: 0,
      failed: 0,
      skipped: 0,
    };
    let reported = 0;
    let progress = 0;

    for (const [index, row] of rows.entries()) {
      let result: RowResult;
      try {
        result = await this.processRow(row, { uploadId: upload.id, periodId: upload.periodId }, customers);
      } catch (error) {
        result = { outcome: 'FAILED' };
        this.logger.error(
          `Payroll upload ${upload.id}, row ${row.row} (${row.staffId})`,
          error instanceof Error ? error.stack : String(error),
        );
        if (reported++ < REPORTED_ERRORS) {
          captureJobError(error, { queue: QueueName.repayments, job: job.name, jobId: job.id });
        }
      }
      summary[result.outcome.toLowerCase() as Lowercase<PayrollRowOutcome>]++;
      if (result.customerId && result.applied?.gt(0)) {
        await this.tellCustomer(result.customerId, label, result.applied, result.unapplied ?? ZERO);
      }

      const percent = Math.floor(((index + 1) / rows.length) * 100);
      if (percent !== progress) {
        progress = percent;
        await job.progress(percent);
      }
    }

    this.logger.log(`Payroll upload ${upload.id} (${label}): ${JSON.stringify(summary)}`);
    await this.tellUploader(upload.uploadedById, summary);
    return summary;
  }

  @OnQueueFailed()
  async onFailed(job: Job<Partial<PayrollUploadJob>>, error: Error): Promise<void> {
    this.logger.error(`${job.name} (${job.id}) failed: ${error.message}`, error.stack);
    captureJobError(error, { queue: QueueName.repayments, job: job.name, jobId: job.id });
    if (job.name !== RepaymentQueueName.process_payroll_upload || !job.data?.uploadId) return;
    try {
      const upload = await this.prisma.payrollUpload.findUnique({
        where: { id: job.data.uploadId },
        select: { uploadedById: true, period: { select: { year: true, month: true } } },
      });
      if (!upload) return;
      await this.inapp.messageUser({
        userId: upload.uploadedById,
        title: 'Payroll Upload Failed',
        message:
          `Processing the ${periodLabel(upload.period)} payroll stopped: ${error.message}. ` +
          'Rows already processed are kept: upload the rest again in a new sheet for the same month (rows already imported are skipped).',
        callToActionUrl: ADMIN_LINKS.payrollUpload(job.data.uploadId),
      });
    } catch (notifyError) {
      this.logger.error('Telling the uploader about a failed payroll upload failed', notifyError);
    }
  }

  /** Customer ids by staff ID (Customer.externalId), for the rows of one sheet. */
  private async customersByStaffId(staffIds: string[]): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    for (const chunk of chunkArray([...new Set(staffIds)], LOOKUP_CHUNK)) {
      const customers = await this.prisma.customer.findMany({
        where: { externalId: { in: chunk } },
        select: { userId: true, externalId: true },
      });
      for (const { userId, externalId } of customers) if (externalId) found.set(externalId, userId);
    }
    return found;
  }

  /**
   * One row, one transaction: the inflow first (a P2002 there = the row is already in), then
   * the customer's payroll details, then the payment against the month's deduction.
   */
  private async processRow(
    row: PayrollRow,
    upload: { uploadId: string; periodId: string },
    customers: Map<string, string>,
  ): Promise<RowResult> {
    const amount = money(row.amount ?? 0);
    if (amount.lte(0)) return { outcome: 'SKIPPED' };
    const customerId = customers.get(row.staffId);

    try {
      return await this.ledgerTx.transaction<RowResult>(async (tx) => {
        const inflow = await tx.paymentInflow.create({
          data: {
            source: 'PAYROLL',
            periodId: upload.periodId,
            uploadId: upload.uploadId,
            amount,
            externalUserId: row.staffId,
            customerId: customerId ?? null,
            state: customerId ? 'REVIEWING' : 'UNMATCHED',
          },
          select: { id: true },
        });
        if (!customerId) return { outcome: 'UNMATCHED' };

        const details = payrollUpdate(row.payroll);
        if (Object.keys(details).length) {
          await tx.customerPayroll.updateMany({ where: { externalId: row.staffId }, data: details });
        }
        return { customerId, ...(await this.applyToDeduction(tx, inflow.id, customerId, upload.periodId, amount)) };
      });
    } catch (error) {
      if (isDuplicateRow(error)) return { outcome: 'DUPLICATE' };
      throw error;
    }
  }

  /**
   * REVIEWING when there's no live loan or no deduction due that month; otherwise the payment
   * settles the deduction, and the inflow is SETTLED unless part of it couldn't be applied.
   */
  private async applyToDeduction(
    tx: Tx,
    inflowId: string,
    customerId: string,
    periodId: string,
    amount: Money,
  ): Promise<Omit<RowResult, 'customerId'>> {
    const loan = await tx.loan.findFirst({
      where: { borrowerId: customerId, status: 'DISBURSED' },
      select: { id: true },
    });
    if (!loan) return { outcome: 'REVIEWING' };
    const deduction = await tx.deduction.findFirst({
      where: { loanId: loan.id, periodId, status: { in: ['AWAITING', 'PARTIAL'] } },
      select: { id: true },
    });
    if (!deduction) return { outcome: 'REVIEWING' };

    const allocation = await this.ledger.allocatePayment(
      { loanId: loan.id, amount, inflowId, deductionId: deduction.id },
      tx,
    );
    const state: PaymentInflowState = allocation.unapplied.gt(0) ? 'REVIEWING' : 'SETTLED';
    await tx.paymentInflow.update({ where: { id: inflowId }, data: { state } });
    return { outcome: state, applied: allocation.applied, unapplied: allocation.unapplied };
  }

  /** After the row's transaction has committed. Never throws (the notifier doesn't). */
  private async tellCustomer(customerId: string, label: string, applied: Money, unapplied: Money): Promise<void> {
    const extra = unapplied.gt(0)
      ? ` ${formatCurrency(toNumber(unapplied))} more than you owed was deducted; we will contact you about a refund.`
      : '';
    try {
      await this.notifier.notify(customerId, {
        title: 'Repayment Received',
        message: `Your repayment of ${formatCurrency(toNumber(applied))} for ${label} has been received and applied to your loan. Thank you.${extra}`,
      });
    } catch (error) {
      this.logger.error(`Repayment notification for ${customerId} failed`, error instanceof Error ? error.stack : error);
    }
  }

  private async tellUploader(adminId: string, summary: PayrollUploadSummary): Promise<void> {
    const parts = [
      `${summary.settled} settled`,
      `${summary.reviewing} for review`,
      `${summary.unmatched} unmatched`,
      `${summary.duplicate} already imported`,
      `${summary.failed} failed`,
    ];
    if (summary.skipped) parts.push(`${summary.skipped} with nothing deducted`);
    const retry = summary.failed
      ? ' Failed rows were not recorded: upload them again in a new sheet for the same month (rows already imported are skipped).'
      : '';
    try {
      await this.inapp.messageUser({
        userId: adminId,
        title: summary.failed ? 'Payroll Upload Processed With Errors' : 'Payroll Upload Processed',
        message: `The ${summary.period} payroll (${summary.rows} rows) is processed: ${parts.join(', ')}.${retry}`,
        callToActionUrl: ADMIN_LINKS.payrollUpload(summary.uploadId),
      });
    } catch (error) {
      this.logger.error(`Payroll upload summary for ${adminId} failed`, error instanceof Error ? error.stack : error);
      captureJobError(error, { queue: QueueName.repayments, job: 'payroll-upload-summary' });
    }
  }
}
