import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Job } from 'bull';
import { differenceInMonths } from 'date-fns';
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
  calculateRepaymentValues,
  chunkArray,
  generateId,
  updateLoanAndConfigs,
} from 'src/common/utils';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';
import * as XLSX from 'xlsx';

function parsePeriodToDate(period: string): Date {
  if (/^\d+$/.test(period.toString())) {
    const serial = parseInt(period.toString(), 10);
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel's day 0
    return new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
  }
  const [monthStr, yearStr] = period.trim().split(' ');

  const monthIndex = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
  const year = parseInt(yearStr, 10);

  if (isNaN(monthIndex) || isNaN(year)) {
    throw new Error(`Invalid period format: ${period}`);
  }

  return new Date(year, monthIndex, 1, 0, 0, 0, 0);
}

@Processor(QueueName.repayments)
export class RepaymentsConsumer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  private readonly logger = new Logger(RepaymentsConsumer.name);

  @Process(RepaymentQueueName.process_new_repayments)
  async handleRepaymentCreationTask(job: Job<UploadRepayment>) {
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

      await this.generateRepaymentsForActiveLoans(period, penaltyRate || 0);
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.every((cell) => !cell)) {
          continue;
        }

        const entry = this.mapRowToEntry(headers, row, period);
        await this.applyRepayment(entry);

        progress = Math.floor(((i + 1) / totalRows) * 100);
        await job.progress(progress);
      }
      await this.markAwaitingRepaymentsAsFailed(period);
      await this.config.setRecentProcessedRepayment(parsePeriodToDate(period));
      this.logger.log(`Successfully processed ${totalRows} repayment entries`);
    } catch (error) {
      this.logger.error(
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

  private async generateRepaymentsForActiveLoans(
    period: string,
    penaltyRate: number,
  ) {
    const periodInDT = parsePeriodToDate(period);

    const activeLoans = await this.prisma.loan.findMany({
      where: { status: 'DISBURSED' },
      select: {
        id: true,
        amountRepayable: true,
        amountRepaid: true,
        loanTenure: true,
        extension: true,
        disbursementDate: true,
        borrowerId: true,
      },
      orderBy: { disbursementDate: 'asc' },
    });

    for (const loan of activeLoans) {
      const existingRepayment = await this.prisma.repayment.findFirst({
        where: {
          userId: loan.borrowerId,
          loanId: loan.id,
          period,
        },
        select: { id: true },
      });
      if (existingRepayment) continue;

      const { penaltyCharge, amountDue } = calculateRepaymentValues(
        Prisma.Decimal(0),
        penaltyRate,
        periodInDT,
        loan,
      );

      if (amountDue.lte(0)) continue;

      await this.prisma.repayment.create({
        data: {
          id: generateId.repaymentId(),
          amount: new Prisma.Decimal(0),
          expectedAmount: amountDue,
          penaltyCharge,
          period,
          periodInDT,
          userId: loan.borrowerId,
          loanId: loan.id,
        },
      });

      if (penaltyCharge.gt(0)) {
        await this.prisma.loan.update({
          where: { id: loan.id },
          data: {
            amountRepayable: { increment: penaltyCharge },
            penaltyAmount: { increment: penaltyCharge },
          },
        });
      }
    }
  }

  private async applyRepayment(repaymentEntry: RepaymentEntry) {
    const {
      repayment: { amount, period },
      externalId,
      payroll,
    } = repaymentEntry;
    let repaymentBalance = new Prisma.Decimal(amount);
    if (repaymentBalance.lte(0)) return;

    let totalPaid = new Prisma.Decimal(0);
    let totalRepayable = new Prisma.Decimal(0);
    const periodInDT = parsePeriodToDate(period);

    const userPayroll = await this.prisma.userPayroll.findUnique({
      where: { userId: externalId },
      select: { user: { select: { id: true } } },
    });

    if (!userPayroll) {
      await this.prisma.repayment.create({
        data: {
          id: generateId.repaymentId(),
          amount,
          period,
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
        period,
        status: 'AWAITING',
        loanId: { not: null },
      },
      select: {
        expectedAmount: true,
        penaltyCharge: true,
        id: true,
        loan: {
          select: {
            id: true,
            amountRepaid: true,
            amountRepayable: true,
            penaltyAmount: true,
          },
        },
      },
      orderBy: { loan: { disbursementDate: 'asc' } },
    });

    for (const repayment of repayments) {
      if (repaymentBalance.lte(0)) break;
      const loan = repayment.loan;
      if (!loan) continue;

      const amountExpected = repayment.expectedAmount.add(
        repayment.penaltyCharge,
      );
      const repaidAmount = Prisma.Decimal.min(repaymentBalance, amountExpected);

      await this.prisma.repayment.update({
        where: { id: repayment.id },
        data: {
          repaidAmount,
          status: repaidAmount.eq(amountExpected) ? 'FULFILLED' : 'PARTIAL',
          amount,
        },
      });

      await updateLoanAndConfigs(this.prisma, this.config, loan, repaidAmount);

      repaymentBalance = repaymentBalance.sub(repaidAmount);
      totalPaid = totalPaid.add(repaidAmount);
      totalRepayable = totalRepayable.add(loan.amountRepayable);
    }

    const repaymentRate = totalRepayable.gt(0)
      ? totalPaid.div(totalRepayable).mul(100).toFixed(0)
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
          period,
          periodInDT,
          status: 'MANUAL_RESOLUTION',
          failureNote: 'An overflow of repayment balance for the given user',
          userId,
        },
      });
    }

    this.logger.log(
      `Applied repayment for user ${userId}, Period: ${period}, balance applied: ${totalPaid.toString()}`,
    );
  }

  private async markAwaitingRepaymentsAsFailed(period: string) {
    const awaitingRepayments = await this.prisma.repayment.findMany({
      where: {
        period,
        status: 'AWAITING',
      },
      select: {
        id: true,
      },
    });

    if (awaitingRepayments.length === 0) {
      this.logger.log(`No AWAITING repayments found for period: ${period}`);
      return;
    }

    const batches = chunkArray(awaitingRepayments); // use 100 default

    for (const batch of batches) {
      const updatePromises = batch.map(async (rep) =>
        this.prisma.repayment.update({
          where: { id: rep.id },
          data: {
            status: 'FAILED',
            failureNote: `Payment not received for period: ${period}`,
          },
          select: {},
        }),
      );

      await Promise.all(updatePromises);
      this.logger.log(
        `Processed batch of ${batch.length} repayments for period: ${period}`,
      );
    }

    this.logger.log(
      `Marked ${awaitingRepayments.length} AWAITING repayments as FAILED for period: ${period}`,
    );
  }

  @Process(RepaymentQueueName.process_overflow_repayments)
  async handleRepaymentOverflow(job: Job<ResolveRepayment>) {
    const penaltyRate = await this.config.getValue('PENALTY_FEE_RATE');
    await this.privateHandleRepayments(
      { ...job.data, _updated: false },
      penaltyRate || 0,
    );
  }

  @Process(RepaymentQueueName.process_liquidation_request)
  async handleLiquidationRequest(job: Job<LiquidationResolution>) {
    const today = new Date();
    const period = today
      .toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
      })
      .toUpperCase();

    const penaltyRate = await this.config.getValue('PENALTY_FEE_RATE');
    await this.privateHandleRepayments(
      { ...job.data, period, _updated: true },
      penaltyRate || 0,
    );

    await this.prisma.liquidationRequest.update({
      where: { id: job.data.liquidationRequestId },
      data: { status: 'APPROVED' },
    });
  }

  private async privateHandleRepayments(
    dto: PrivateRepaymentHandler,
    penaltyRate: number,
  ) {
    const { period, userId, amount, repaymentId, resolutionNote, _updated } =
      dto;

    let updated = _updated;
    const periodInDT = parsePeriodToDate(period);
    const activeUserLoans = await this.prisma.loan.findMany({
      where: { status: 'DISBURSED', borrowerId: userId },
      select: {
        id: true,
        amountRepayable: true,
        amountRepaid: true,
        loanTenure: true,
        extension: true,
        disbursementDate: true,
        penaltyAmount: true,
      },
      orderBy: { disbursementDate: 'asc' },
    });

    if (activeUserLoans.length === 0) return;

    let repaymentBalance = new Prisma.Decimal(amount);
    let totalPaid = new Prisma.Decimal(0);
    let totalRepayable = new Prisma.Decimal(0);

    for (const loan of activeUserLoans) {
      if (repaymentBalance.lte(0)) break;

      const { repaymentAmount, penaltyCharge, amountDue } =
        calculateRepaymentValues(
          repaymentBalance,
          penaltyRate,
          periodInDT,
          loan,
        );

      if (amountDue.lte(0)) continue;
      const totalPayable = amountDue.add(penaltyCharge);

      const status = repaymentAmount.eq(totalPayable) ? 'FULFILLED' : 'PARTIAL';

      if (updated === false) {
        updated = true;
        await this.prisma.repayment.update({
          where: { id: repaymentId },
          data: {
            failureNote: null,
            userId,
            loanId: loan.id,
            status,
            penaltyCharge,
            repaidAmount: repaymentAmount,
            expectedAmount: amountDue,
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
            expectedAmount: amountDue,
            periodInDT,
            userId,
            loanId: loan.id,
            status,
            penaltyCharge,
          },
        });
      }

      if (penaltyCharge.gt(0)) {
        await this.prisma.loan.update({
          where: { id: loan.id },
          data: {
            amountRepayable: { increment: penaltyCharge },
            penaltyAmount: { increment: penaltyCharge },
          },
        });
      }

      const amountRepayable = await updateLoanAndConfigs(
        this.prisma,
        this.config,
        loan,
        repaymentAmount,
      );

      repaymentBalance = repaymentBalance.sub(repaymentAmount);
      totalPaid = totalPaid.add(repaymentAmount);
      totalRepayable = totalRepayable.add(amountRepayable);
    }

    const repaymentRate = totalRepayable.gt(0)
      ? totalPaid.div(totalRepayable).mul(100).toFixed(0)
      : '0';

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        repaymentRate: Number(repaymentRate),
      },
    });
  }
}

@Processor(QueueName.existing_users)
export class ExistingUsersConsumer {
  @Process()
  async handleTask(job: Job<unknown>) {
    let progress = 0;

    for (let i = 0; i < 1; i++) {
      progress++;

      await job.progress(progress);
    }
  }
}
