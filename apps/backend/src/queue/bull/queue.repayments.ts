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
import { QueueName, RepaymentQueueName, type VoucherJob } from 'src/common/types/queue.interface';
import {
  PAYROLL_UPLOADS_BUCKET,
  type PayrollRowOutcome,
  type VoucherSettlement,
  type VoucherSummary,
} from 'src/common/types/repayment.interface';
import { formatCurrency } from 'src/common/utils';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { customersByStaffId, type StaffMatch } from 'src/admin/repayments/voucher-rows';
import { LedgerService } from 'src/ledger/ledger.service';
import { LedgerTx, type Tx } from 'src/ledger/ledger.tx';
import { money, toNumber, ZERO, type Money } from 'src/ledger/money';
import { VariationLockService, type SettleSummary } from 'src/ledger/variation-lock.service';
import { CustomerNotifierService } from 'src/notifications/customer-notifier.service';
import { InappService } from 'src/notifications/inapp.service';
import { ADMIN_LINKS } from 'src/notifications/admin-notifier.service';

/** Unexpected row failures sent to Sentry per job: an outage fails every row the same way. */
const REPORTED_ERRORS = 5;

interface RowResult {
  outcome: PayrollRowOutcome;
  customerId?: string;
  /** What reached the loan, and what was paid beyond it (to refund). */
  applied?: Money;
  unapplied?: Money;
}

/** The voucher a row belongs to, and the variation its payment is made against. */
interface VoucherContext {
  voucherId: string;
  variationId: string;
  organizationId: string;
  periodId: string;
}

/**
 * CustomerPayroll fields from the row, only where the sheet has a value (V2.MD §0.5). Never the organization: a
 * voucher's organization column holds commands, and the organization changes only by change request (PLAN_V2 P2).
 */
function payrollUpdate(payroll: PayrollDetails): Prisma.CustomerPayrollUpdateManyMutationInput {
  return {
    ...(payroll.grade && { grade: payroll.grade }),
    ...(payroll.step > 0 && { step: payroll.step }),
    ...(payroll.command && { command: payroll.command }),
    ...(payroll.employeeGross > 0 && { employeeGross: money(payroll.employeeGross) }),
    ...(payroll.netPay > 0 && { netPay: money(payroll.netPay) }),
  };
}

function isDuplicateRow(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// A voucher, row by row, then the settling of its variation (PLAN_V2 R4). Each row is its own transaction: the
// PAYROLL inflow, the CustomerPayroll update and the allocation commit together or not at all. The partial unique
// index on (externalUserId, periodId) makes a row already imported fail with P2002, so it is skipped as a duplicate
// and running the job again is safe. After the last row the variation settles (FAILED / PARTIAL, penalties), its
// loans get their next month's OPEN row and the superseded variation files go; each of those skips what is done.
@Processor(QueueName.repayments)
export class RepaymentsConsumer {
  private readonly logger = new Logger(RepaymentsConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly ledgerTx: LedgerTx,
    private readonly ledger: LedgerService,
    private readonly locks: VariationLockService,
    private readonly notifier: CustomerNotifierService,
    private readonly inapp: InappService,
  ) {}

  @Process(RepaymentQueueName.process_voucher)
  async processVoucher(job: Job<VoucherJob>): Promise<VoucherSummary> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: job.data.voucherId },
      select: {
        id: true,
        fileHash: true,
        filename: true,
        uploadedById: true,
        variation: {
          select: {
            id: true,
            periodId: true,
            organizationId: true,
            organization: { select: { name: true } },
            period: { select: { year: true, month: true } },
          },
        },
      },
    });
    if (!voucher) throw new Error(`Voucher ${job.data.voucherId} not found`);
    const { variation } = voucher;
    const period: Period = variation.period;
    const label = periodLabel(period);
    const organization = variation.organization.name;
    const context: VoucherContext = {
      voucherId: voucher.id,
      variationId: variation.id,
      organizationId: variation.organizationId,
      periodId: variation.periodId,
    };

    const file = await this.supabase.downloadPrivate(PAYROLL_UPLOADS_BUCKET, payrollUploadPath(period, voucher.fileHash));
    const { missingColumns, rows } = readPayrollSheet(file);
    if (missingColumns.length) throw new Error(`The stored sheet is missing columns: ${missingColumns.join(', ')}`);
    const customers = await customersByStaffId(
      this.prisma,
      rows.map((row) => row.staffId).filter(Boolean),
    );

    const summary: VoucherSummary = {
      voucherId: voucher.id,
      variationId: variation.id,
      organization,
      period: label,
      rows: rows.length,
      settled: 0,
      reviewing: 0,
      unmatched: 0,
      duplicate: 0,
      failed: 0,
      skipped: 0,
      settlement: null,
    };
    let reported = 0;
    let progress = 0;

    for (const [index, row] of rows.entries()) {
      let result: RowResult;
      try {
        result = await this.processRow(row, context, customers);
      } catch (error) {
        result = { outcome: 'FAILED' };
        this.logger.error(
          `Voucher ${voucher.id}, row ${row.row} (${row.staffId})`,
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

    // R4 steps 2 and 3. A failure here fails the job: running it again redoes only what is left.
    const settled = await this.locks.settleVariation(variation.id, voucher.uploadedById);
    summary.settlement = this.settlementOf(settled);
    const refreshed = await this.locks.afterLock(variation.id);
    const problems = [...settled.errors.map((e) => e.message), ...refreshed.errors];
    if (problems.length) {
      throw new Error(`${organization} ${label}: ${problems.length} steps of settling the variation failed: ${problems[0]}`);
    }

    await this.auditOnce(voucher.id, voucher.uploadedById, voucher.filename, summary);
    this.logger.log(`Voucher ${voucher.id} (${organization} ${label}): ${JSON.stringify(summary)}`);
    await this.tellUploader(voucher.uploadedById, summary);
    return summary;
  }

  @OnQueueFailed()
  async onFailed(job: Job<Partial<VoucherJob>>, error: Error): Promise<void> {
    this.logger.error(`${job.name} (${job.id}) failed: ${error.message}`, error.stack);
    captureJobError(error, { queue: QueueName.repayments, job: job.name, jobId: job.id });
    if (job.name !== RepaymentQueueName.process_voucher || !job.data?.voucherId) return;
    try {
      const voucher = await this.prisma.voucher.findUnique({
        where: { id: job.data.voucherId },
        select: {
          uploadedById: true,
          variation: {
            select: { organization: { select: { name: true } }, period: { select: { year: true, month: true } } },
          },
        },
      });
      if (!voucher) return;
      await this.inapp.messageUser({
        userId: voucher.uploadedById,
        title: 'Voucher Processing Failed',
        message:
          `Processing the ${voucher.variation.organization.name} ${periodLabel(voucher.variation.period)} voucher stopped: ${error.message}. ` +
          'Rows already processed are kept. Retrying the job finishes the rest (rows already imported are skipped); ' +
          'or revert the voucher and upload it again.',
        callToActionUrl: ADMIN_LINKS.voucher(job.data.voucherId),
      });
    } catch (notifyError) {
      this.logger.error('Telling the uploader about a failed voucher failed', notifyError);
    }
  }

  private settlementOf(settled: SettleSummary): VoucherSettlement {
    return {
      settled: settled.settled,
      failed: settled.failed,
      partial: settled.partial,
      penalties: settled.penalties,
      penaltyTotal: settled.penaltyTotal,
      proposals: settled.proposals,
    };
  }

  /**
   * VOUCHER_UPLOADED, once the voucher is fully processed, with the counts and the issues it left (R4 step 3). The
   * counts are what the voucher's inflows hold now, so a second run of the job (which finds every row a duplicate)
   * writes nothing new.
   */
  private async auditOnce(voucherId: string, actorId: string, filename: string, summary: VoucherSummary): Promise<void> {
    const written = await this.prisma.auditLog.findFirst({
      where: { action: 'VOUCHER_UPLOADED', entityType: 'VOUCHER', entityId: voucherId },
      select: { id: true },
    });
    if (written) return;
    const states = await this.prisma.paymentInflow.groupBy({ by: ['state'], where: { voucherId }, _count: true });
    const inState = (state: PaymentInflowState) => states.find((row) => row.state === state)?._count ?? 0;
    const counts = {
      rows: summary.rows,
      settled: inState('SETTLED'),
      reviewing: inState('REVIEWING'),
      unmatched: inState('UNMATCHED'),
      skipped: summary.skipped,
      failed: summary.failed,
    };
    const { settlement } = summary;
    const parts = [
      `${counts.settled} settled`,
      `${counts.reviewing} for review`,
      `${counts.unmatched} unmatched`,
      ...(settlement
        ? [`${settlement.failed} deductions failed, ${settlement.partial} short, ${settlement.penalties} penalties`]
        : []),
    ];
    await this.ledgerTx.transaction((tx) =>
      this.ledgerTx.audit(tx, {
        actorId,
        action: 'VOUCHER_UPLOADED',
        entityType: 'VOUCHER',
        entityId: voucherId,
        note: `${summary.organization} ${summary.period} voucher, ${counts.rows} rows (${filename}): ${parts.join(', ')}`,
        meta: { variationId: summary.variationId, ...counts, settlement } as unknown as Prisma.InputJsonValue,
      }),
    );
  }

  /**
   * One row, one transaction: the inflow first (a P2002 there = the row is already in), then the customer's
   * payroll details, then the payment against the loan's deduction in this variation.
   */
  private async processRow(
    row: PayrollRow,
    context: VoucherContext,
    customers: Map<string, StaffMatch>,
  ): Promise<RowResult> {
    const amount = money(row.amount ?? 0);
    if (amount.lte(0)) return { outcome: 'SKIPPED' };
    const match = customers.get(row.staffId);

    try {
      return await this.ledgerTx.transaction<RowResult>(async (tx) => {
        const inflow = await tx.paymentInflow.create({
          data: {
            source: 'PAYROLL',
            periodId: context.periodId,
            voucherId: context.voucherId,
            amount,
            externalUserId: row.staffId,
            customerId: match?.customerId ?? null,
            state: match ? 'REVIEWING' : 'UNMATCHED',
          },
          select: { id: true },
        });
        if (!match) return { outcome: 'UNMATCHED' };

        // The sheet's details describe this organization's people: leave another organization's customer alone.
        const details = payrollUpdate(row.payroll);
        if (match.organizationId === context.organizationId && Object.keys(details).length) {
          await tx.customerPayroll.updateMany({ where: { externalId: row.staffId }, data: details });
        }
        return {
          customerId: match.customerId,
          ...(await this.applyToDeduction(tx, inflow.id, match.customerId, context.variationId, amount)),
        };
      });
    } catch (error) {
      if (isDuplicateRow(error)) return { outcome: 'DUPLICATE' };
      throw error;
    }
  }

  /**
   * REVIEWING when the customer has no deduction waiting in this variation (no live loan, the loan or the customer is
   * in another organization, or its deduction is elsewhere); otherwise the payment settles the deduction, and the
   * inflow is SETTLED unless part of it couldn't be applied.
   */
  private async applyToDeduction(
    tx: Tx,
    inflowId: string,
    customerId: string,
    variationId: string,
    amount: Money,
  ): Promise<Omit<RowResult, 'customerId'>> {
    const deduction = await tx.deduction.findFirst({
      where: {
        variationId,
        status: { in: ['AWAITING', 'PARTIAL'] },
        loan: { borrowerId: customerId, status: 'DISBURSED' },
      },
      select: { id: true, loanId: true },
    });
    if (!deduction) return { outcome: 'REVIEWING' };

    const allocation = await this.ledger.allocatePayment(
      { loanId: deduction.loanId, amount, inflowId, deductionId: deduction.id },
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

  private async tellUploader(adminId: string, summary: VoucherSummary): Promise<void> {
    const parts = [
      `${summary.settled} settled`,
      `${summary.reviewing} for review`,
      `${summary.unmatched} unmatched`,
      `${summary.duplicate} already imported`,
      `${summary.failed} failed`,
    ];
    if (summary.skipped) parts.push(`${summary.skipped} with nothing deducted`);
    const { settlement } = summary;
    const outcome = settlement
      ? ` ${settlement.failed + settlement.partial} deductions came in short or missing; ${settlement.penalties} penalties were charged.`
      : '';
    const retry = summary.failed
      ? ' Failed rows were not recorded: revert the voucher and upload it again to include them.'
      : '';
    try {
      await this.inapp.messageUser({
        userId: adminId,
        title: summary.failed ? 'Voucher Processed With Errors' : 'Voucher Processed',
        message: `The ${summary.organization} ${summary.period} voucher (${summary.rows} rows) is processed: ${parts.join(', ')}.${outcome}${retry}`,
        callToActionUrl: ADMIN_LINKS.voucher(summary.voucherId),
      });
    } catch (error) {
      this.logger.error(`Voucher summary for ${adminId} failed`, error instanceof Error ? error.stack : error);
      captureJobError(error, { queue: QueueName.repayments, job: 'voucher-summary' });
    }
  }
}
