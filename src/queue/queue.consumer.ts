import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { LiquidationStatus, Prisma } from '@prisma/client';
import { Job } from 'bull';
import { addMonths, subDays } from 'date-fns';
import { QueueName } from 'src/common/types';
import {
  RepaymentQueueName,
  ReportQueueName,
} from 'src/common/types/queue.interface';
import type {
  LiquidationResolution,
  PrivateRepaymentHandler,
  RepaymentEntry,
  ResolveRepayment,
  UploadRepayment,
} from 'src/common/types/repayment.interface';
import {
  GenerateMonthlyLoanSchedule,
  ScheduleVariation,
} from 'src/common/types/report.interface';
import {
  calculateActiveLoanRepayment,
  chunkArray,
  generateId,
  updateLoansAndConfigs,
} from 'src/common/utils';
import { calculateThisMonthPayment } from 'src/common/utils/shared-repayment.logic';
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

const DECIMAL_ZERO = new Prisma.Decimal(0);

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

    const activeLoans = await this.prisma.activeLoan.findMany({
      select: {
        id: true,
        amountRepayable: true,
        amountRepaid: true,
        tenure: true,
        disbursementDate: true,
        userId: true,
      },
      orderBy: { disbursementDate: 'asc' },
    });

    for (const activeLoan of activeLoans) {
      const { penaltyCharge, amountDue } = calculateActiveLoanRepayment(
        Prisma.Decimal(0),
        penaltyRate,
        periodInDT,
        activeLoan,
      );

      if (amountDue.lte(0)) continue;
      let remainingDue = amountDue;

      const disbursedLoans = await this.prisma.loan.findMany({
        where: { borrowerId: activeLoan.userId, status: 'DISBURSED' },
        orderBy: { disbursementDate: 'asc' },
        select: { id: true, amountRepayable: true, amountRepaid: true },
      });

      for (const loan of disbursedLoans) {
        if (remainingDue.lte(0)) break;
        const existingRepayment = await this.prisma.repayment.findFirst({
          where: {
            userId: activeLoan.userId,
            loanId: loan.id,
            period,
          },
          select: { id: true },
        });
        if (existingRepayment) continue;

        const stillOwed = loan.amountRepayable.sub(loan.amountRepaid);
        if (stillOwed.lte(0)) continue;

        const expectedAmount = Prisma.Decimal.min(stillOwed, remainingDue);
        let penaltyShare = DECIMAL_ZERO;
        if (penaltyCharge.gt(0)) {
          penaltyShare = penaltyCharge.mul(expectedAmount).div(amountDue);
        }

        await this.prisma.repayment.create({
          data: {
            id: generateId.repaymentId(),
            amount: DECIMAL_ZERO, // actual cash collected can update later
            expectedAmount,
            penaltyCharge: penaltyShare,
            period,
            periodInDT,
            userId: activeLoan.userId,
            loanId: loan.id,
          },
        });

        remainingDue = remainingDue.sub(expectedAmount);
      }

      if (penaltyCharge.gt(0)) {
        await this.prisma.activeLoan.update({
          where: { id: activeLoan.id },
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

    let totalPaid = DECIMAL_ZERO;
    let totalExpected = DECIMAL_ZERO;
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
            amountRepayable: true,
            amountRepaid: true,
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

      const { penaltyCharge } = await this.prisma.repayment.update({
        where: { id: repayment.id },
        data: {
          repaidAmount,
          status: repaidAmount.eq(amountExpected) ? 'FULFILLED' : 'PARTIAL',
          amount,
        },
        select: { penaltyCharge: true },
      });

      await updateLoansAndConfigs(
        this.prisma,
        this.config,
        repaidAmount,
        penaltyCharge,
        loan,
      );

      repaymentBalance = repaymentBalance.sub(repaidAmount);
      totalPaid = totalPaid.add(repaidAmount);
      totalExpected = totalExpected.add(repayment.expectedAmount);
    }

    const loanChecks = await this.prisma.activeLoan.update({
      where: { userId },
      data: {
        amountRepaid: { increment: totalPaid },
      },
      select: { amountRepaid: true, amountRepayable: true, id: true },
    });

    if (loanChecks.amountRepaid.gte(loanChecks.amountRepayable)) {
      await this.prisma.activeLoan.delete({ where: { id: loanChecks.id } });
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
    await this.allocateRepayment(job.data);
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

    const state = await this.allocateRepayment({ ...job.data, period });

    await this.prisma.liquidationRequest.update({
      where: { id: job.data.liquidationRequestId },
      data: { status: state },
    });
  }

  private async allocateRepayment(dto: PrivateRepaymentHandler) {
    const { period, userId, amount, repaymentId, resolutionNote } = dto;

    const periodInDT = parsePeriodToDate(period);
    const activeUserLoan = await this.prisma.activeLoan.findUnique({
      where: { userId },
      select: {
        id: true,
        amountRepayable: true,
        amountRepaid: true,
        tenure: true,
        disbursementDate: true,
        penaltyAmount: true,
      },
    });
    if (!activeUserLoan) return LiquidationStatus.REJECTED;

    let repaymentBalance = new Prisma.Decimal(amount);

    const disbursedLoans = await this.prisma.loan.findMany({
      where: { borrowerId: userId, status: 'DISBURSED' },
      orderBy: { disbursementDate: 'asc' },
      select: { id: true, amountRepayable: true, amountRepaid: true },
    });

    for (const loan of disbursedLoans) {
      if (repaymentBalance.lte(0)) break;
      const repaymentAmount = Prisma.Decimal.min(
        repaymentBalance,
        loan.amountRepayable,
      );
      const status = repaymentAmount.eq(loan.amountRepayable)
        ? 'FULFILLED'
        : 'PARTIAL';

      if (repaymentId) {
        await this.prisma.repayment.update({
          where: { id: repaymentId },
          data: {
            failureNote: null,
            userId,
            loanId: loan.id,
            status,
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
            status,
            liquidationRequestId: dto.liquidationRequestId,
          },
        });
      }

      await this.prisma.loan.update({
        where: { id: loan.id },
        data: {
          amountRepaid: { increment: repaymentAmount },
        },
      });

      await updateLoansAndConfigs(
        this.prisma,
        this.config,
        repaymentAmount,
        DECIMAL_ZERO,
        loan,
      );

      repaymentBalance = repaymentBalance.sub(repaymentAmount);
    }

    const loanChecks = await this.prisma.activeLoan.update({
      where: { id: activeUserLoan.id },
      data: {
        amountRepaid: { increment: new Prisma.Decimal(amount) },
      },
      select: { amountRepaid: true, amountRepayable: true },
    });

    if (loanChecks.amountRepaid.gte(loanChecks.amountRepayable)) {
      await this.prisma.activeLoan.delete({
        where: { id: activeUserLoan.id },
      });
    }

    return LiquidationStatus.APPROVED;
  }
}

@Processor(QueueName.reports)
export class GenerateReportConsumer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  @Process(ReportQueueName.schedule_variation)
  async generateScheduleVariation(job: Job<GenerateMonthlyLoanSchedule>) {
    const { period, email } = job.data;
    const loanData = await this.generateLoanData(period);
    await job.progress(40);

    const rows = [];
    let counter = 1;

    for (const data of loanData) {
      rows.push({
        'S/NO': counter++,
        'IPPIS NO.': data.externalId,
        'NAMES OF BENEFICIARIES': data.name,
        COMMAND: data.command,
        'LOAN BALANCE': data.balance,
        AMOUNT: data.expected,
        TENURE: data.tenure,
        'START DATE': data.start,
        'END DATE': data.end,
      });
    }
    await job.progress(70);

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      `${period} Loan Schedule`,
    );

    // XLSX.writeFile(workbook, 'loans.xlsx');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  private async generateLoanData(period: string) {
    const periodInDT = parsePeriodToDate(period);
    const activeLoans = await this.prisma.activeLoan.findMany({
      select: {
        amountRepayable: true,
        amountRepaid: true,
        tenure: true,
        disbursementDate: true,
        user: {
          select: {
            externalId: true,
            name: true,
            payroll: { select: { command: true } },
          },
        },
      },
    });
    const penaltyRate = await this.config.getValue('PENALTY_FEE_RATE');

    const data: ScheduleVariation[] = [];
    for (const { user, ...loan } of activeLoans) {
      if (!user || !user.payroll) {
        // Notify Admins that this user has no info and or payroll data
        continue;
      }

      const { totalPayable } = calculateThisMonthPayment(
        penaltyRate || 0,
        periodInDT,
        loan,
      );
      const endDate = subDays(addMonths(loan.disbursementDate, loan.tenure), 1);
      const balance = loan.amountRepayable.sub(loan.amountRepaid);

      data.push({
        externalId: user.externalId!,
        name: user.name,
        command: user.payroll.command,
        tenure: loan.tenure,
        start: loan.disbursementDate,
        end: endDate,
        expected: totalPayable.toNumber(),
        balance: balance.toNumber(),
      });
    }

    return data;
  }

  @Process(ReportQueueName.customer_report)
  async generateCustomerLoanReport(job: Job<unknown>) {}
}
