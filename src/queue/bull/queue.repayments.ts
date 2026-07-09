import {
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Job } from 'bull';
import { logic } from 'src/common/logic/repayment.logic';
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
  LoanRecordUpdate,
  PrivateRepaymentHandler,
  RepaymentEntry,
  ResolveRepayment,
  UploadRepayment,
} from 'src/common/types/repayment.interface';
import {
  chunkArray,
  formatCurrency,
  generateId,
  parseDateToPeriod,
  parsePeriodToDate,
} from 'src/common/utils';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';
import { CustomerNotifierService } from 'src/notifications/customer-notifier.service';
import * as XLSX from 'xlsx';

const DECIMAL_ZERO = new Prisma.Decimal(0);

@Processor(QueueName.repayments)
export class RepaymentsConsumer {
  private readonly logger = new Logger(RepaymentsConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifier: CustomerNotifierService,
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
          await this.applyRepayment(entry, penaltyRate, batchStats, payrollMap);
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
    const rowData: { [key: string]: any } = {};
    headers.forEach((header, index) => {
      rowData[header.toLowerCase().replace(/\s+/g, '')] = row[index];
    });
    const orgIdx = getOrganizationHeaderIndex(headers);
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
    const periodInDT = parsePeriodToDate(period);

    const activeLoans = await this.prisma.loan.findMany({
      where: { status: 'DISBURSED' },
      select: {
        id: true,
        principal: true,
        penalty: true,
        tenure: true,
        interestRate: true,
        extension: true,
        borrowerId: true,
        penaltyRepaid: true,
      },
      orderBy: { disbursementDate: 'asc' },
    });

    this.debug('generateRepaymentsForActiveLoans:activeLoans', {
      period,
      activeLoans: activeLoans.length,
    });

    if (activeLoans.length === 0) return;

    const existingRepayments = await this.prisma.repayment.findMany({
      where: {
        period,
        source: 'PAYROLL',
        loanId: { in: activeLoans.map((l) => l.id) },
      },
      select: { loanId: true },
    });

    this.debug('generateRepaymentsForActiveLoans:existingRepayments', {
      period,
      existing_repayments: existingRepayments.length,
    });

    const existingLoanIds = new Set(existingRepayments.map((r) => r.loanId));
    const repaymentsToCreate = [];

    for (const loan of activeLoans) {
      if (existingLoanIds.has(loan.id)) continue;

      const principal = loan.principal.toNumber();
      const rate = loan.interestRate.toNumber();

      const amountDue = logic.getMonthlyPayment(
        principal,
        rate,
        loan.tenure,
        loan.extension,
      );

      const penalty = loan.penalty.sub(loan.penaltyRepaid);
      const expected = penalty.add(amountDue);

      const repayment = {
        id: generateId.repaymentId(),
        amount: DECIMAL_ZERO,
        expectedAmount: expected,
        penaltyCharge: penalty,
        period,
        periodInDT,
        userId: loan.borrowerId,
        loanId: loan.id,
        status: 'AWAITING',
        source: 'PAYROLL',
      } as const;

      repaymentsToCreate.push(repayment);
    }

    if (repaymentsToCreate.length > 0) {
      this.debug('generateRepaymentsForActiveLoans:createMany', {
        repaymentsToCreate: repaymentsToCreate.length,
      });
      await this.prisma.repayment.createMany({
        data: repaymentsToCreate,
      });
    }
  }

  private async applyRepayment(
    repaymentEntry: RepaymentEntry,
    rate: number,
    stats: FinancialAccumulator,
    payrollMap: Awaited<ReturnType<typeof this.getPayrollMap>>,
  ) {
    const { repayment, externalId, payroll } = repaymentEntry;
    const repaymentAmount = new Prisma.Decimal(repayment.amount);
    let repaymentBalance = repaymentAmount;

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

    const existingProcessedPayroll = await this.prisma.repayment.findFirst({
      where: {
        userId,
        period: repayment.period,
        source: 'PAYROLL',
        status: { not: 'AWAITING' },
      },
      select: { id: true },
    });
    if (existingProcessedPayroll) {
      this.debug('applyRepayment:skip:duplicatePayrollRow', {
        externalId,
        userId,
        period: repayment.period,
      });
      return;
    }

    const repayments = await this.prisma.repayment.findMany({
      where: {
        userId,
        period: repayment.period,
        source: 'PAYROLL',
        status: 'AWAITING',
        loanId: { not: null },
      },
      select: {
        expectedAmount: true,
        id: true,
        loan: {
          select: {
            id: true,
            principal: true,
            tenure: true,
            extension: true,
            repaid: true,
            penalty: true,
            interestRate: true,
            disbursementDate: true,
            penaltyRepaid: true,
            repayable: true,
          },
        },
      },
      orderBy: { loan: { disbursementDate: 'asc' } },
    });

    if (repayments.length > 0) {
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
    }

    for (const repayment of repayments) {
      if (repaymentBalance.lte(0)) break;
      const loan = repayment.loan;
      if (!loan) continue;

      const amountExpected = repayment.expectedAmount;
      const repaidAmount = Prisma.Decimal.min(repaymentBalance, amountExpected);
      const status = repaidAmount.eq(amountExpected) ? 'FULFILLED' : 'PARTIAL';

      const overdue = amountExpected.sub(repaidAmount);
      const newPenalty = overdue.mul(rate);

      const { interest, penalty, principalPaid } = logic.getLoanRevenue(
        repaidAmount,
        loan,
      );

      await this.prisma.repayment.update({
        where: { id: repayment.id },
        data: {
          repaidAmount,
          status,
          amount: repaymentAmount,
          interestPaid: interest,
        },
      });

      const financialUpdate = {
        penalty: newPenalty,
        penaltyPaid: penalty,
        repaidAmount: principalPaid.add(interest),
        totalPayable: loan.repayable.add(loan.penalty),
      };

      await this.updateLoanRecord(loan, financialUpdate);

      stats.totalRepaid += repaidAmount.toNumber();
      stats.totalPenaltyRevenue += penalty.toNumber();
      stats.totalInterestRevenue += interest.toNumber();

      repaymentBalance = repaymentBalance.sub(repaidAmount);
    }

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

    if (repaymentBalance.gt(0)) {
      this.debug('applyRepayment:overflow', {
        userId,
        overflow: repaymentBalance.toNumber(),
      });
      await this.prisma.repayment.create({
        data: {
          id: generateId.repaymentId(),
          amount: repaymentBalance,
          period: repayment.period,
          periodInDT,
          status: 'MANUAL_RESOLUTION',
          source: 'OVERFLOW',
          failureNote: 'Overflow of repayment balance',
          userId,
        },
      });
    }

    const appliedAmount = repaymentAmount.sub(repaymentBalance);
    if (appliedAmount.gt(0)) {
      await this.notifier.notify(userId, {
        title: 'Repayment Received',
        message: `Your repayment of ${formatCurrency(appliedAmount.toNumber())} for ${repayment.period} has been received and applied to your loan. Thank you.`,
      });
    }
  }

  @Process(RepaymentQueueName.close_repayment_period)
  async handleCloseRepaymentPeriod(job: Job<CloseRepaymentPeriod>) {
    const { period } = job.data;
    const penaltyRate = (await this.config.getValue('PENALTY_FEE_RATE')) || 0;
    const totalPenaltyAdded = await this.markAwaitingRepaymentsAsFailed(
      period,
      penaltyRate,
    );

    if (totalPenaltyAdded.gt(DECIMAL_ZERO)) {
      await this.config.topupValue(
        'BALANCE_OUTSTANDING',
        totalPenaltyAdded.toNumber(),
      );
    }

    await this.config.setRecentProcessedRepayment(parsePeriodToDate(period));
  }

  private async updateLoanRecord(
    loan: { id: string; repaid: Prisma.Decimal },
    update: LoanRecordUpdate,
  ) {
    const { repaidAmount, totalPayable, penalty, penaltyPaid } = update;
    const amountRepaid = loan.repaid.add(repaidAmount);
    const totalRepaid = amountRepaid.add(penaltyPaid);

    await this.prisma.loan.update({
      where: { id: loan.id },
      data: {
        repaid: amountRepaid,
        penalty: { increment: penalty },
        penaltyRepaid: { increment: penaltyPaid },
        ...(totalRepaid.gte(totalPayable.add(penalty)) && { status: 'REPAID' }),
        ...(penalty.gt(0) && { extension: { increment: 1 } }),
      },
    });
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

  private async markAwaitingRepaymentsAsFailed(period: string, rate: number) {
    const awaitingRepayments = await this.prisma.repayment.findMany({
      where: {
        period,
        source: 'PAYROLL',
        status: 'AWAITING',
      },
      select: {
        id: true,
        expectedAmount: true,
        userId: true,
      },
    });

    if (awaitingRepayments.length === 0) return DECIMAL_ZERO;
    let totalPenaltyAdded = DECIMAL_ZERO;

    const batches = chunkArray(awaitingRepayments); // use 100 default
    for (const batch of batches) {
      const updatePromises = batch.map(async (rep) => {
        const penalty = rep.expectedAmount.mul(rate);
        totalPenaltyAdded = totalPenaltyAdded.add(penalty);

        return this.prisma.repayment.update({
          where: { id: rep.id },
          data: {
            status: 'FAILED',
            failureNote: `Payment not received for period: ${period}`,
            loan: {
              update: {
                penalty: { increment: penalty },
                extension: { increment: 1 },
              },
            },
          },
          select: { id: true },
        });
      });

      await Promise.all(updatePromises);
    }

    const missedByUser = new Map<string, Prisma.Decimal>();
    for (const rep of awaitingRepayments) {
      if (!rep.userId) continue;
      const current = missedByUser.get(rep.userId) ?? DECIMAL_ZERO;
      missedByUser.set(rep.userId, current.add(rep.expectedAmount));
    }
    for (const [userId, expected] of missedByUser) {
      await this.notifier.notify(userId, {
        title: 'Missed Repayment',
        message: `Your expected repayment of ${formatCurrency(expected.toNumber())} for ${period} was not received. A penalty charge has been added to your loan balance. Please contact support if you believe this is an error.`,
      });
    }

    return totalPenaltyAdded;
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
    const periodInDT = parsePeriodToDate(period);
    let repaymentBalance = new Prisma.Decimal(amount);

    const loans = await this.prisma.loan.findMany({
      where: { borrowerId: userId, status: 'DISBURSED' },
      orderBy: [
        { tenure: 'asc' },
        { disbursementDate: 'asc' },
        { principal: 'asc' },
      ],
      select: {
        id: true,
        principal: true,
        penalty: true,
        tenure: true,
        extension: true,
        interestRate: true,
        repaid: true,
        disbursementDate: true,
        penaltyRepaid: true,
        repayable: true,
      },
    });

    const singleStats: FinancialAccumulator = {
      totalRepaid: 0,
      totalInterestRevenue: 0,
      totalPenaltyRevenue: 0,
    };

    let repaymentRowUsed = false;

    for (const loan of loans) {
      if (repaymentBalance.lte(0)) break;
      const repayable = loan.repayable.add(loan.penalty);
      const repaid = loan.repaid.add(loan.penaltyRepaid);

      const owed = repayable.sub(repaid);
      const repaymentAmount = Prisma.Decimal.min(repaymentBalance, owed);

      const { penalty, interest, principalPaid } = logic.getLoanRevenue(
        repaymentAmount,
        loan,
      );

      if (repaymentId && !repaymentRowUsed) {
        await this.prisma.repayment.update({
          where: { id: repaymentId },
          data: {
            failureNote: null,
            userId,
            loanId: loan.id,
            status: 'FULFILLED',
            repaidAmount: repaymentAmount,
            expectedAmount: repaymentAmount,
            interestPaid: interest,
            resolutionNote,
          },
        });
        repaymentRowUsed = true;
      } else if (repaymentId) {
        await this.prisma.repayment.create({
          data: {
            id: generateId.repaymentId(),
            amount: repaymentAmount,
            period,
            repaidAmount: repaymentAmount,
            expectedAmount: repaymentAmount,
            periodInDT,
            userId,
            loanId: loan.id,
            status: 'FULFILLED',
            interestPaid: interest,
            resolutionNote,
            source: 'OVERFLOW',
          },
        });
      } else {
        if (dto.liquidationRequestId) {
          const existing = await this.prisma.repayment.findFirst({
            where: {
              liquidationRequestId: dto.liquidationRequestId,
              loanId: loan.id,
            },
            select: { repaidAmount: true },
          });
          if (existing) {
            repaymentBalance = repaymentBalance.sub(existing.repaidAmount);
            const revenue = logic.getLoanRevenue(existing.repaidAmount, loan);
            singleStats.totalRepaid += existing.repaidAmount.toNumber();
            singleStats.totalInterestRevenue += revenue.interest.toNumber();
            singleStats.totalPenaltyRevenue += revenue.penalty.toNumber();
            continue;
          }
        }

        await this.prisma.repayment.create({
          data: {
            id: generateId.repaymentId(),
            amount,
            period,
            repaidAmount: repaymentAmount,
            expectedAmount: repaymentAmount,
            periodInDT,
            userId,
            loanId: loan.id,
            status: 'FULFILLED',
            interestPaid: interest,
            liquidationRequestId: dto.liquidationRequestId,
            source: dto.liquidationRequestId ? 'LIQUIDATION' : 'OVERFLOW',
          },
        });
      }

      const updates = {
        penalty: DECIMAL_ZERO,
        repaidAmount: principalPaid.add(interest),
        totalPayable: repayable,
        penaltyPaid: penalty,
      };

      await this.updateLoanRecord(loan, updates);

      singleStats.totalRepaid += repaymentAmount.toNumber();
      singleStats.totalInterestRevenue += interest.toNumber();
      singleStats.totalPenaltyRevenue += penalty.toNumber();

      repaymentBalance = repaymentBalance.sub(repaymentAmount);
    }

    await this.updateGlobalConfigs(singleStats);

    // The liquidation path notifies from handleLiquidationRequest with the
    // final outcome, so only announce manual/overflow resolutions here.
    if (repaymentId && singleStats.totalRepaid > 0) {
      await this.notifier.notify(userId, {
        title: 'Repayment Received',
        message: `A repayment of ${formatCurrency(singleStats.totalRepaid)} for ${period} has been applied to your loan. Thank you.`,
      });
    }
  }
}
