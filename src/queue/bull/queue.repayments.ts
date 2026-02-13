import { Process, Processor } from '@nestjs/bull';
import { Loan, Prisma } from '@prisma/client';
import { Job } from 'bull';
import { logic } from 'src/common/logic/repayment.logic';
import { QueueName } from 'src/common/types';
import { RepaymentQueueName } from 'src/common/types/queue.interface';
import type {
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
  generateId,
  parseDateToPeriod,
  parsePeriodToDate,
} from 'src/common/utils';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';
import * as XLSX from 'xlsx';

const DECIMAL_ZERO = new Prisma.Decimal(0);

@Processor(QueueName.repayments)
export class RepaymentsConsumer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Process(RepaymentQueueName.process_new_repayments)
  async handleIPPISrepayment(job: Job<UploadRepayment>) {
    const { url, period } = job.data;
    let progress = 0;

    const batchStats: FinancialAccumulator = {
      totalRepaid: 0,
      totalInterestRevenue: 0,
      totalPenaltyRevenue: 0,
      totalFailedPenalties: 0, // review to remove
    };
    try {
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

      await this.generateRepaymentsForActiveLoans(period);
      const staffIdIndex = headers.findIndex(
        (h) => h.toLowerCase().replace(/\s+/g, '') === 'staffid',
      );
      const allStaffIds = dataRows
        .map((row) => (staffIdIndex > -1 ? String(row[staffIdIndex]) : null))
        .filter((id) => id !== null);

      const payrollMap = await this.getPayrollMap(allStaffIds);

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.every((cell) => !cell)) continue;

        const entry = this.mapRowToEntry(headers, row, period);
        await this.applyRepayment(entry, penaltyRate, batchStats, payrollMap);

        progress = Math.floor(((i + 1) / totalRows) * 100);
        await job.progress(progress);
      }

      const failedPenalty = await this.markAwaitingRepaymentsAsFailed(
        period,
        penaltyRate,
      );
      batchStats.totalFailedPenalties = failedPenalty;

      await this.updateGlobalConfigs(batchStats);
      await this.config.setRecentProcessedRepayment(parsePeriodToDate(period));
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

    const payroll = {
      grade: String(rowData['grade'] || ''),
      step: Number(rowData['step'] || ''),
      command: String(rowData['command'] || ''),
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

    if (activeLoans.length === 0) return;

    const existingRepayments = await this.prisma.repayment.findMany({
      where: {
        period,
        loanId: { in: activeLoans.map((l) => l.id) },
      },
      select: { loanId: true },
    });

    const existingLoanIds = new Set(existingRepayments.map((r) => r.loanId));
    const repaymentsToCreate = [];

    for (const loan of activeLoans) {
      if (existingLoanIds.has(loan.id)) continue;

      const principal = Number(loan.principal);
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
        period,
        periodInDT,
        userId: loan.borrowerId,
        loanId: loan.id,
        status: 'AWAITING',
      } as const;

      repaymentsToCreate.push(repayment);
    }

    if (repaymentsToCreate.length > 0) {
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

    if (repaymentBalance.lte(0)) return;

    const periodInDT = parsePeriodToDate(repayment.period);
    const userMapData = payrollMap.get(externalId);

    if (!userMapData) {
      await this.prisma.repayment.create({
        data: {
          id: generateId.repaymentId(),
          amount: repaymentAmount,
          period: repayment.period,
          periodInDT,
          status: 'MANUAL_RESOLUTION',
          failureNote: `No corresponding IPPIS ID found for the given staff id: ${externalId}`,
        },
      });
      return;
    }

    await this.prisma.userPayroll.update({
      where: { userId: externalId },
      data: { ...payroll },
    });

    const userId = userMapData.userId;

    const repayments = await this.prisma.repayment.findMany({
      where: {
        userId,
        period: repayment.period,
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

    let totalPaidByUser = DECIMAL_ZERO;
    let totalExpectedByUser = DECIMAL_ZERO;

    for (const repayment of repayments) {
      if (repaymentBalance.lte(0)) break;
      const loan = repayment.loan;
      if (!loan) continue;

      const amountExpected = repayment.expectedAmount;
      const repaidAmount = Prisma.Decimal.min(repaymentBalance, amountExpected);
      const status = repaidAmount.eq(amountExpected) ? 'FULFILLED' : 'PARTIAL';

      const overdue = amountExpected.sub(repaidAmount);
      const penaltyFee = overdue.gt(DECIMAL_ZERO)
        ? overdue.mul(rate)
        : DECIMAL_ZERO;

      await this.prisma.repayment.update({
        where: { id: repayment.id },
        data: {
          repaidAmount,
          status,
          amount: repaymentAmount,
          penaltyCharge: penaltyFee,
        },
      });

      const { interest, penalty: penaltyPaid } = logic.getLoanRevenue(
        repaidAmount,
        loan,
      );

      const principal = loan.principal.add(loan.penalty);
      const financialUpdate = {
        penalty: penaltyFee,
        repaidAmount,
        totalPayable: principal.add(penalty),
      };

      await this.updateLoanRecord(loan, financialUpdate);

      stats.totalRepaid += repaidAmount.toNumber();
      stats.totalPenaltyRevenue += penaltyPaid.toNumber();
      stats.totalInterestRevenue += interest.toNumber();

      repaymentBalance = repaymentBalance.sub(repaidAmount);
      totalPaidByUser = totalPaidByUser.add(repaidAmount);
      totalExpectedByUser = totalExpectedByUser.add(repayment.expectedAmount);
    }

    const repaymentRate = totalExpectedByUser.gt(0)
      ? totalPaidByUser.div(totalExpectedByUser).mul(100).toFixed(0)
      : '0';

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        repaymentRate: Number(repaymentRate),
      },
    });

    if (repaymentBalance.gt(0)) {
      await this.prisma.repayment.create({
        data: {
          id: generateId.repaymentId(),
          amount: repaymentBalance,
          period: repayment.period,
          periodInDT,
          status: 'MANUAL_RESOLUTION',
          failureNote: 'Overflow of repayment balance',
          userId,
        },
      });
    }
  }

  private async updateLoanRecord(
    loan: { id: string; repaid: Prisma.Decimal },
    update: LoanRecordUpdate,
  ) {
    const { repaidAmount, totalPayable, penalty } = update;
    const amountRepaid = loan.repaid.add(repaidAmount);

    await this.prisma.loan.update({
      where: { id: loan.id },
      data: {
        repaid: amountRepaid,
        penalty: { increment: penalty },
        ...(amountRepaid.gte(totalPayable) && { status: 'REPAID' }),
        ...(penalty.gt(0) && { extension: { increment: 1 } }),
      },
    });
  }

  private async updateGlobalConfigs(stats: FinancialAccumulator) {
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
    const penalties = stats.totalPenaltyRevenue + stats.totalFailedPenalties;
    if (penalties > 0)
      updates.push(this.config.topupValue('PENALTY_FEE_REVENUE', penalties));

    await Promise.all(updates);
  }

  private async getPayrollMap(staffIds: string[]) {
    const payrolls = await this.prisma.userPayroll.findMany({
      where: { userId: { in: staffIds } },
      select: { userId: true, user: { select: { id: true } } },
    });
    return new Map(
      payrolls.map((p) => [
        p.userId,
        { userId: p.user.id, payrollId: p.userId },
      ]),
    );
  }

  private async markAwaitingRepaymentsAsFailed(period: string, rate: number) {
    const awaitingRepayments = await this.prisma.repayment.findMany({
      where: {
        period,
        status: 'AWAITING',
      },
      select: {
        id: true,
        expectedAmount: true,
      },
    });

    if (awaitingRepayments.length === 0) return 0;

    let totalPenaltyGenerated = 0;
    const batches = chunkArray(awaitingRepayments); // use 100 default

    for (const batch of batches) {
      const updatePromises = batch.map(async (rep) => {
        const penalty = rep.expectedAmount.mul(rate);
        totalPenaltyGenerated += penalty.toNumber();

        return this.prisma.repayment.update({
          where: { id: rep.id },
          data: {
            status: 'FAILED',
            failureNote: `Payment not received for period: ${period}`,
            penaltyCharge: penalty,
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

    return totalPenaltyGenerated;
  }

  @Process(RepaymentQueueName.process_overflow_repayments)
  async handleRepaymentOverflow(job: Job<ResolveRepayment>) {
    await this.allocateRepayment(job.data);
  }

  @Process(RepaymentQueueName.process_liquidation_request)
  async handleLiquidationRequest(job: Job<LiquidationResolution>) {
    const period = parseDateToPeriod();
    await this.allocateRepayment({ ...job.data, period });

    await this.prisma.liquidationRequest.update({
      where: { id: job.data.liquidationRequestId },
      data: { status: 'APPROVED' },
    });
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
      },
    });

    const singleStats: FinancialAccumulator = {
      totalRepaid: 0,
      totalInterestRevenue: 0,
      totalPenaltyRevenue: 0,
      totalFailedPenalties: 0,
    };

    for (const loan of loans) {
      if (repaymentBalance.lte(0)) break;
      const principal = loan.principal.add(loan.penalty);
      const repaymentAmount = Prisma.Decimal.min(repaymentBalance, principal);

      if (repaymentId) {
        await this.prisma.repayment.update({
          where: { id: repaymentId },
          data: {
            failureNote: null,
            userId,
            loanId: loan.id,
            status: 'FULFILLED',
            repaidAmount: repaymentAmount,
            expectedAmount: repaymentAmount,
            resolutionNote,
          },
        });
      } else {
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
            liquidationRequestId: dto.liquidationRequestId,
          },
        });
      }

      const interestRevenue = this.calculateInterestRevenue(
        loan,
        repaymentAmount,
        false,
      );

      const updates = {
        penalty: DECIMAL_ZERO,
        repaidAmount: repaymentAmount,
        totalPayable: principal,
      };

      await this.updateLoanRecord(loan, updates);

      singleStats.totalRepaid += repaymentAmount.toNumber();
      singleStats.totalInterestRevenue += interestRevenue;

      repaymentBalance = repaymentBalance.sub(repaymentAmount);
    }

    await this.updateGlobalConfigs(singleStats);
  }
}
