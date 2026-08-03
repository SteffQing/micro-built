import {
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Job } from 'bull';
import { createHash } from 'crypto';
import {
  getOrganizationHeaderIndex,
  validateHeaders,
} from 'src/common/logic/repayment-validation';
import { QueueName } from 'src/common/types';
import { RepaymentQueueName } from 'src/common/types/queue.interface';
import type {
  CloseRepaymentPeriod,
  FinancialAccumulator,
  LiquidationResolution,
  PrivateRepaymentHandler,
  RepaymentEntry,
  ResolveRepayment,
  UploadRepayment,
} from 'src/common/types/repayment.interface';
import {
  formatCurrency,
  generateId,
  parseDateToPeriod,
  parsePeriodToDate,
} from 'src/common/utils';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';
import { CustomerNotifierService } from 'src/notifications/customer-notifier.service';
import * as XLSX from 'xlsx';
import { RepaymentObligationService } from 'src/obligations/repayment-obligation.service';

const DECIMAL_ZERO = new Prisma.Decimal(0);

@Processor(QueueName.repayments)
export class RepaymentsConsumer {
  private readonly logger = new Logger(RepaymentsConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifier: CustomerNotifierService,
    private readonly obligations: RepaymentObligationService,
  ) {}

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    console.log('FAILED JOB', job.id, err);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    console.log('JOB COMPLETED:', job.id);
  }

  private debug(message: string, meta?: Record<string, unknown>) {
    // if (process.env.DEBUG_REPAYMENTS !== 'true') return;
    if (!meta) this.logger.debug(message);
    else this.logger.debug(`${message} ${JSON.stringify(meta)}`);
  }

  @Process(RepaymentQueueName.process_new_repayments)
  async handleIPPISrepayment(job: Job<UploadRepayment>) {
    const { url, period } = job.data;
    let progress = 0;

    const batchStats: FinancialAccumulator = {
      totalRepaid: 0,
      totalInterestRevenue: 0,
      totalPenaltyRevenue: 0,
    };
    try {
      // job-entry idempotency. LAST_REPAYMENT_DATE is set once this period
      // finishes (line below). If the job is re-run for an already-finished period
      // (manual re-enqueue, or a future attempts>1 retry of a completed job), skip it
      // so the dashboard counters can't be added twice. A mid-run crash leaves the
      // marker unset, so a retry still resumes — and the AWAITING-status filters in
      // applyRepayment / markAwaitingRepaymentsAsFailed keep that resume from
      // double-counting already-processed rows.
      const lastProcessed = await this.config.getValue('LAST_REPAYMENT_DATE');
      if (
        lastProcessed instanceof Date &&
        lastProcessed.getTime() === parsePeriodToDate(period).getTime()
      ) {
        this.debug('handleIPPISrepayment:skip:alreadyProcessed', { period });
        return;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      const penaltyRate = (await this.config.getValue('PENALTY_FEE_RATE')) || 0;

      const buffer = await response.arrayBuffer();
      const fileHash = createHash('sha256')
        .update(Buffer.from(buffer))
        .digest('hex');
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (rawData.length < 2) throw new Error('Excel file appears to be empty');

      const headers = rawData[0] as string[];
      const dataRows = rawData.slice(1) as any[][];
      const totalRows = dataRows.length;

      this.debug('handleIPPISrepayment:excelParsed', {
        headers: headers.length,
        dataRows: totalRows,
      });

      const { valid, missing } = validateHeaders(headers);
      if (!valid) {
        throw new Error(
          `Invalid Excel format. Missing required columns: ${missing.join(', ')}`,
        );
      }

      // if I should validate the rows too

      await this.generateRepaymentsForActiveLoans(period);
      // perhaps set a threshold (date) for disbursed loans to determine eligibility to be awarded an awaiting repayment model - can't expect John who's disbursed loan was June 29th, to be expected to repay June 30th
      const staffIdIndex = headers.findIndex(
        (h) => h.toLowerCase().replace(/\s+/g, '') === 'staffid',
      );

      const allStaffIds = dataRows
        .map((row) => (staffIdIndex > -1 ? String(row[staffIdIndex]) : null))
        .filter((id) => id !== null);

      const payrollMap = await this.getPayrollMap(allStaffIds);

      this.debug('handleIPPISrepayment:payrollMap', {
        inputStaffIds: allStaffIds.length,
        payrollMapSize: payrollMap.size,
      });

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.every((cell) => !cell)) continue;

        const entry = this.mapRowToEntry(headers, row, period);

        this.debug('handleIPPISrepayment:row', {
          i: i + 1,
          externalId: entry.externalId,
          amount: entry.repayment.amount,
        });
        if (entry.repayment.amount > 0) {
          await this.applyRepayment(
            entry,
            penaltyRate,
            batchStats,
            payrollMap,
            `${fileHash}:${i + 1}`,
          );
        }

        progress = Math.floor(((i + 1) / totalRows) * 100);
        await job.progress(progress);
      }

      this.debug('handleIPPISrepayment:batchStats', batchStats as any);
      await this.updateGlobalConfigs(batchStats);

      this.debug('handleIPPISrepayment:done');
    } catch (error) {
      console.error(
        `Failed to process repayments: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private mapRowToEntry(
    headers: string[],
    row: any[],
    period: string,
  ): RepaymentEntry {
    const normalizedHeaders = headers.map((header) =>
      header.toLowerCase().replace(/\s+/g, ''),
    );
    const rowData: { [key: string]: any } = {};
    headers.forEach((header, index) => {
      rowData[header.toLowerCase().replace(/\s+/g, '')] = row[index];
    });
    const orgIdx = getOrganizationHeaderIndex(normalizedHeaders);
    const organization = orgIdx > -1 ? String(row[orgIdx] || '') : '';

    const payroll = {
      grade: String(rowData['grade'] || ''),
      step: Number(rowData['step'] || ''),
      command: String(rowData['command'] || ''),
      organization,
      employeeGross: parseFloat(rowData['employeegross']) || 0,
      netPay: parseFloat(rowData['netpay']) || 0,
    };

    const repayment = {
      // period: String(rowData['period'] || ''),
      amount: parseFloat(rowData['amount']) || 0,
      period,
    };

    return {
      externalId: String(rowData['staffid'] || ''),
      payroll,
      repayment,
    };
  }

  private async generateRepaymentsForActiveLoans(period: string) {
    await this.obligations.backfillActiveObligations(parsePeriodToDate(period));
    const created =
      await this.obligations.createCompatibilityExpectations(period);
    this.debug('generateRepaymentsForActiveLoans:canonicalInstallments', {
      period,
      created,
    });
  }

  private async applyRepayment(
    repaymentEntry: RepaymentEntry,
    _rate: number,
    stats: FinancialAccumulator,
    payrollMap: Awaited<ReturnType<typeof this.getPayrollMap>>,
    sourceReference: string,
  ) {
    const { repayment, externalId, payroll } = repaymentEntry;
    const repaymentAmount = new Prisma.Decimal(repayment.amount);
    const periodInDT = parsePeriodToDate(repayment.period);
    const userId = payrollMap.get(externalId);

    if (!userId) {
      this.debug('applyRepayment:noUserId', { externalId });
      await this.prisma.repayment.create({
        data: {
          id: generateId.repaymentId(),
          amount: repaymentAmount,
          period: repayment.period,
          periodInDT,
          status: 'MANUAL_RESOLUTION',
          source: 'MANUAL',
          failureNote: `No corresponding IPPIS ID found for the given staff id: ${externalId}`,
        },
      });
      return;
    }

    await this.prisma.userPayroll.update({
      where: { userId: externalId },
      data: {
        ...(payroll.employeeGross > 0 && {
          employeeGross: payroll.employeeGross,
        }),
        ...(payroll.netPay > 0 && { netPay: payroll.netPay }),
        ...(payroll.grade && { grade: payroll.grade }),
        ...(payroll.step > 0 && { step: payroll.step }),
        ...(payroll.command && { command: payroll.command }),
        ...(payroll.organization && { organization: payroll.organization }),
      },
    });

    const result = await this.obligations.applyPayrollPayment({
      userId,
      period: repayment.period,
      amount: repaymentAmount,
      externalReference: `${externalId}:${repayment.period}:${sourceReference}`,
      rawPayload: { externalId, payroll, sourceReference },
    });
    if (result.duplicate) {
      this.debug('applyRepayment:skip:duplicatePayrollRow', {
        externalId,
        userId,
        period: repayment.period,
      });
      return;
    }

    stats.totalRepaid += result.applied;
    stats.totalPenaltyRevenue += result.penaltyPaid;
    stats.totalInterestRevenue += result.interestPaid;

    const rateAgg = await this.prisma.repayment.aggregate({
      where: {
        userId,
        status: { notIn: ['AWAITING', 'MANUAL_RESOLUTION'] },
      },
      _sum: { repaidAmount: true, expectedAmount: true },
    });
    const totalPaid = rateAgg._sum.repaidAmount ?? DECIMAL_ZERO;
    const totalExpected = rateAgg._sum.expectedAmount ?? DECIMAL_ZERO;
    const repaymentRate = totalExpected.gt(DECIMAL_ZERO)
      ? totalPaid.div(totalExpected).mul(100).toFixed(0)
      : '0';

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        repaymentRate: Number(repaymentRate),
      },
    });

    if (result.credit > 0) {
      this.debug('applyRepayment:overflow', {
        userId,
        overflow: result.credit,
      });
    }

    if (result.applied > 0) {
      await this.notifier.notify(userId, {
        title: 'Repayment Received',
        message: `Your repayment of ${formatCurrency(result.applied)} for ${repayment.period} has been received and applied to your consolidated loan obligation. Thank you.`,
      });
    }
  }

  @Process(RepaymentQueueName.close_repayment_period)
  async handleCloseRepaymentPeriod(job: Job<CloseRepaymentPeriod>) {
    const { period } = job.data;
    const penaltyRate = (await this.config.getValue('PENALTY_FEE_RATE')) || 0;
    const closeResult = await this.obligations.closeRepaymentPeriod(
      period,
      penaltyRate,
    );
    const totalPenaltyAdded = closeResult.totalPenalty;

    if (totalPenaltyAdded.gt(DECIMAL_ZERO)) {
      await this.config.topupValue(
        'BALANCE_OUTSTANDING',
        totalPenaltyAdded.toNumber(),
      );
    }

    for (const notice of closeResult.notifications) {
      await this.notifier.notify(notice.userId, {
        title: 'Missed Repayment',
        message: `Your expected repayment of ${formatCurrency(notice.expected)} for ${period} received ${formatCurrency(notice.paid)}. The shortfall is ${formatCurrency(notice.shortfall)} and a penalty of ${formatCurrency(notice.penalty)} was added. Your future repayment plan has been revised.`,
      });
    }

    await this.config.setRecentProcessedRepayment(parsePeriodToDate(period));
  }

  private async updateGlobalConfigs(stats: FinancialAccumulator) {
    this.debug('updateGlobalConfigs', stats as any);
    const updates = [];
    if (stats.totalRepaid > 0) {
      updates.push(this.config.topupValue('TOTAL_REPAID', stats.totalRepaid));
      updates.push(
        this.config.depleteValue('BALANCE_OUTSTANDING', stats.totalRepaid),
      );
    }
    if (stats.totalInterestRevenue > 0)
      updates.push(
        this.config.topupValue(
          'INTEREST_RATE_REVENUE',
          stats.totalInterestRevenue,
        ),
      );
    if (stats.totalPenaltyRevenue > 0)
      updates.push(
        this.config.topupValue(
          'PENALTY_FEE_REVENUE',
          stats.totalPenaltyRevenue,
        ),
      );

    for (const update of updates) {
      await update;
    }
  }

  private async getPayrollMap(staffIds: string[]) {
    this.debug('getPayrollMap:start', { staffIds: staffIds.length });
    const payrolls = await this.prisma.userPayroll.findMany({
      where: { userId: { in: staffIds } },
      select: { userId: true, user: { select: { id: true } } },
    });
    this.debug('getPayrollMap:done', {
      payrolls: payrolls.length,
      amiss: staffIds.length - payrolls.length,
    });
    return new Map(payrolls.map((p) => [p.userId, p.user.id]));
  }

  @Process(RepaymentQueueName.process_overflow_repayments)
  async handleRepaymentOverflow(job: Job<ResolveRepayment>) {
    // ponytail: idempotency guard. Queue runs attempts=1 (no retries) today, but if
    // retries are ever enabled a re-run must not re-increment loan.repaid. The
    // liquidation path already self-guards via its existing-repayment check.
    const existing = await this.prisma.repayment.findUnique({
      where: { id: job.data.repaymentId },
      select: { status: true },
    });
    if (existing?.status === 'FULFILLED') return;
    await this.allocateRepayment(job.data);
  }

  @Process(RepaymentQueueName.process_liquidation_request)
  async handleLiquidationRequest(job: Job<LiquidationResolution>) {
    try {
      const period = parseDateToPeriod();
      await this.allocateRepayment({ ...job.data, period });

      await this.prisma.liquidationRequest.update({
        where: { id: job.data.liquidationRequestId },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });

      await this.notifier.notify(job.data.userId, {
        title: 'Loan Liquidation Approved',
        message: `Your loan liquidation of ${formatCurrency(job.data.amount)} has been approved and applied to your outstanding loan balance.`,
      });
    } catch (error) {
      console.error(error);
      await this.prisma.liquidationRequest.update({
        where: { id: job.data.liquidationRequestId },
        data: { status: 'REJECTED', approvedAt: null },
      });

      await this.notifier.notify(job.data.userId, {
        title: 'Loan Liquidation Rejected',
        message: `Your loan liquidation request of ${formatCurrency(job.data.amount)} could not be processed and has been rejected. Please contact support for more details.`,
      });
    }
  }

  private async allocateRepayment(dto: PrivateRepaymentHandler) {
    const { period, userId, amount, repaymentId, resolutionNote } = dto;
    await this.obligations.backfillActiveObligations(new Date());
    const result = await this.obligations.applyUnscheduledPayment({
      userId,
      amount,
      source: dto.liquidationRequestId ? 'LIQUIDATION' : 'OVERFLOW',
      externalReference:
        dto.liquidationRequestId ??
        repaymentId ??
        `${userId}:${period}:${amount}`,
      actorId: dto.liquidationRequestId
        ? 'LIQUIDATION_APPROVAL'
        : 'MANUAL_RESOLUTION',
      period,
      compatibilityRepaymentId: repaymentId,
      liquidationRequestId: dto.liquidationRequestId,
      resolutionNote,
    });

    await this.updateGlobalConfigs({
      totalRepaid: result.applied.toNumber(),
      totalInterestRevenue: result.interestPaid.toNumber(),
      totalPenaltyRevenue: result.penaltyPaid.toNumber(),
    });

    // The liquidation path notifies from handleLiquidationRequest with the
    // final outcome, so only announce manual/overflow resolutions here.
    if (repaymentId && result.applied.gt(0)) {
      await this.notifier.notify(userId, {
        title: 'Repayment Received',
        message: `A repayment of ${formatCurrency(result.applied.toNumber())} for ${period} has been applied to your consolidated loan obligation. Thank you.`,
      });
    }
  }
}
