import { Process, Processor } from '@nestjs/bull';
import { Prisma } from '@prisma/client';
import { Job } from 'bull';
import { QueueName } from 'src/common/types';
import { RepaymentQueueName } from 'src/common/types/queue.interface';
import type {
  LiquidationResolution,
  PrivateRepaymentHandler,
  RepaymentEntry,
  ResolveRepayment,
  UploadRepayment,
} from 'src/common/types/repayment.interface';
import {
  chunkArray,
  generateId,
  updateLoansAndConfigs,
  parseDateToPeriod,
  parsePeriodToDate,
} from 'src/common/utils';
import { calculateAmortizedPayment } from 'src/common/utils/shared-repayment.logic';
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

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const penaltyRate = await this.config.getValue('PENALTY_FEE_RATE');

      const buffer = await response.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (rawData.length < 2) {
        throw new Error('Excel file appears to be empty or has no data rows');
      }

      const headers = rawData[0] as string[];
      const dataRows = rawData.slice(1) as any[][];
      const totalRows = dataRows.length;

      await this.generateRepaymentsForActiveLoans(period);
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.every((cell) => !cell)) {
          continue;
        }

        const entry = this.mapRowToEntry(headers, row, period);
        await this.applyRepayment(entry, penaltyRate || 0);

        progress = Math.floor(((i + 1) / totalRows) * 100);
        await job.progress(progress);
      }
      await this.markAwaitingRepaymentsAsFailed(period, penaltyRate || 0);
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
      },
      orderBy: { disbursementDate: 'asc' },
    });

    for (const loan of activeLoans) {
      const principal = Number(loan.principal.add(loan.penalty));
      const months = loan.tenure + loan.extension;
      const rate = loan.interestRate.toNumber();

      const amountDue = calculateAmortizedPayment(principal, rate, months);

      const existingRepayment = await this.prisma.repayment.findFirst({
        where: {
          userId: loan.borrowerId,
          loanId: loan.id,
          period,
        },
        select: { id: true },
      });
      if (existingRepayment) continue;

      await this.prisma.repayment.create({
        data: {
          id: generateId.repaymentId(),
          amount: DECIMAL_ZERO, // actual cash collected, update later
          expectedAmount: amountDue,
          period,
          periodInDT,
          userId: loan.borrowerId,
          loanId: loan.id,
        },
      });
    }
  }

  private async applyRepayment(repaymentEntry: RepaymentEntry, rate: number) {
    const { repayment, externalId, payroll } = repaymentEntry;

    const repaymentAmount = new Prisma.Decimal(repayment.amount);
    let repaymentBalance = repaymentAmount;
    if (repaymentBalance.lte(0)) return;

    let totalPaid = DECIMAL_ZERO;
    let totalExpected = DECIMAL_ZERO;
    const periodInDT = parsePeriodToDate(repayment.period);

    const userPayroll = await this.prisma.userPayroll.findUnique({
      where: { userId: externalId },
      select: { user: { select: { id: true } } },
    });

    if (!userPayroll) {
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

    const userId = userPayroll.user.id;

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
          },
        },
      },
      orderBy: { loan: { disbursementDate: 'asc' } },
    });

    for (const repayment of repayments) {
      if (repaymentBalance.lte(0)) break;
      const loan = repayment.loan;
      if (!loan) continue;

      const amountExpected = repayment.expectedAmount;
      const repaidAmount = Prisma.Decimal.min(repaymentBalance, amountExpected);
      const status = repaidAmount.eq(amountExpected) ? 'FULFILLED' : 'PARTIAL';

      const overdue = amountExpected.sub(repaidAmount);
      const penalty = overdue.gt(DECIMAL_ZERO)
        ? overdue.mul(rate)
        : DECIMAL_ZERO;

      await this.prisma.repayment.update({
        where: { id: repayment.id },
        data: {
          repaidAmount,
          status: status,
          amount: repaymentAmount,
          penaltyCharge: penalty,
        },
      });

      const months = loan.tenure + loan.extension;
      const interest = amountExpected
        .mul(months)
        .sub(loan.principal.add(loan.penalty));

      const update = {
        interestRevenue: interest,
        penalty,
        repaidAmount,
        totalPayable: amountExpected.mul(months),
      };

      await updateLoansAndConfigs(this.prisma, this.config, loan, update);

      repaymentBalance = repaymentBalance.sub(repaidAmount);
      totalPaid = totalPaid.add(repaidAmount);
      totalExpected = totalExpected.add(repayment.expectedAmount);
    }

    const repaymentRate = totalExpected.gt(0)
      ? totalPaid.div(totalExpected).mul(100).toFixed(0)
      : '0';

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        repaymentRate: Number(repaymentRate),
      },
    });

    if (repaymentBalance.greaterThan(0)) {
      await this.prisma.repayment.create({
        data: {
          id: generateId.repaymentId(),
          amount: repaymentBalance,
          period: repayment.period,
          periodInDT,
          status: 'MANUAL_RESOLUTION',
          failureNote: 'An overflow of repayment balance for the given user',
          userId,
        },
      });
    }
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

    if (awaitingRepayments.length === 0) {
      console.log(`No AWAITING repayments found for period: ${period}`);
      return;
    }

    const batches = chunkArray(awaitingRepayments); // use 100 default

    for (const batch of batches) {
      const updatePromises = batch.map(async (rep) => {
        const penalty = rep.expectedAmount.mul(rate);

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
      console.log(
        `Processed batch of ${batch.length} repayments for period: ${period}`,
      );
    }

    console.log(
      `Marked ${awaitingRepayments.length} AWAITING repayments as FAILED for period: ${period}`,
    );
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
      },
    });

    for (const loan of loans) {
      if (repaymentBalance.lte(0)) break;
      const repaymentAmount = Prisma.Decimal.min(
        repaymentBalance,
        loan.principal.add(loan.penalty),
      );

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

      const principal = Number(loan.principal.add(loan.penalty));
      const months = loan.tenure + loan.extension;
      const rate = loan.interestRate.toNumber();

      const interestRevenue = repaymentAmount.mul(months).sub(principal);

      const pmt = calculateAmortizedPayment(principal, rate, months);
      const totalPayable = pmt * months;

      const updates = {
        interestRevenue,
        penalty: DECIMAL_ZERO,
        repaidAmount: repaymentAmount,
        totalPayable: new Prisma.Decimal(totalPayable),
      };

      await updateLoansAndConfigs(this.prisma, this.config, loan, updates);

      repaymentBalance = repaymentBalance.sub(repaymentAmount);
    }
  }
}
