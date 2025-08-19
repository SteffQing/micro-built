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
import { generateId } from 'src/common/utils';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/prisma/prisma.service';
import * as XLSX from 'xlsx';

function parsePeriodToDate(period: string): Date {
  if (/^\d+$/.test(period.toString())) {
    const serial = parseInt(period.toString(), 10);
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel's day 0
    return new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
  }
  const [monthStr, yearStr] = period.trim().split(' ');

  const now = new Date();
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ms = now.getMilliseconds();

  const monthIndex = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
  const year = parseInt(yearStr, 10);

  if (isNaN(monthIndex) || isNaN(year)) {
    throw new Error(`Invalid period format: ${period}`);
  }

  return new Date(year, monthIndex, day, hours, minutes, seconds, ms);
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

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.every((cell) => !cell)) {
          continue;
        }

        try {
          const entry = this.mapRowToEntry(headers, row, period);
          await this.generateRepaymentModel(entry);

          progress = Math.floor(((i + 1) / totalRows) * 100);
          await job.progress(progress);
        } catch (error) {
          this.logger.error(
            `Error processing row ${i + 1}: ${error.message}`,
            error.stack,
          );
        }
      }

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

  private async generateRepaymentModel(repaymentEntry: RepaymentEntry) {
    const { externalId, repayment, payroll } = repaymentEntry;
    this.logger.log(
      `Generating repayment model for Staff ID: ${externalId}, Period: ${repayment.period}`,
    );

    const userPayroll = await this.prisma.userPayroll.findUnique({
      where: { userId: externalId },
      select: { user: { select: { id: true } } },
    });
    const periodInDT = parsePeriodToDate(repayment.period);

    if (!userPayroll) {
      await this.prisma.repayment.create({
        data: {
          id: generateId.repaymentId(),
          ...repayment,
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
    const activeUserLoans = await this.prisma.loan.findMany({
      where: { status: 'DISBURSED', borrowerId: userId },
      select: {
        id: true,
        amountRepayable: true,
        amountRepaid: true,
        loanTenure: true,
        extension: true,
        disbursementDate: true,
      },
      orderBy: { disbursementDate: 'asc' },
    });

    let repaymentBalance = new Prisma.Decimal(repayment.amount);
    let totalPaid = new Prisma.Decimal(0);
    let totalRepayable = new Prisma.Decimal(0);

    for (const loan of activeUserLoans) {
      const totalTenure = loan.loanTenure + loan.extension;

      const monthlyRepayment = loan.amountRepayable.div(totalTenure);
      const monthsSinceDisbursement = differenceInMonths(
        periodInDT,
        loan.disbursementDate!,
      );
      const periodsDue = Math.min(monthsSinceDisbursement + 1, totalTenure);
      // const isOverdue = monthsSinceDisbursement >= totalTenure; // -> should notify user and admin of this overdue loan

      const amountExpected = monthlyRepayment.mul(periodsDue);
      const amountDue = amountExpected.sub(loan.amountRepaid);
      const repaymentAmount = Prisma.Decimal.min(repaymentBalance, amountDue);

      if (amountDue.lte(0)) continue;
      if (repaymentAmount.lte(0)) break;

      await this.prisma.repayment.create({
        data: {
          id: generateId.repaymentId(),
          ...repayment,
          repaidAmount: repaymentAmount,
          expectedAmount: amountDue,
          periodInDT,
          userId,
          loanId: loan.id,
          status: repaymentAmount.eq(amountDue) ? 'FULFILLED' : 'PARTIAL',
        },
      });

      const amountRepaid = loan.amountRepaid.add(repaymentAmount);
      const updatedLoan = await this.prisma.loan.update({
        where: { id: loan.id },
        data: {
          amountRepaid,
          ...(amountRepaid.gte(loan.amountRepayable) && { status: 'REPAID' }),
        },
        select: { amount: true, status: true },
      });

      await this.config.topupValue('TOTAL_REPAID', repaymentAmount.toNumber());
      if (updatedLoan.status === 'REPAID') {
        const interestRateRevenue = loan.amountRepayable.sub(
          updatedLoan.amount,
        );
        await this.config.topupValue(
          'INTEREST_RATE_REVENUE',
          interestRateRevenue.toNumber(),
        );
      }

      repaymentBalance = repaymentBalance.sub(repaymentAmount);
      totalPaid = totalPaid.add(repaymentAmount);
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
          period: repayment.period,
          periodInDT,
          status: 'MANUAL_RESOLUTION',
          failureNote: 'An overflow of repayment balance for the given user',
          userId,
          amount: repaymentBalance,
        },
      });
    }
  }

  @Process(RepaymentQueueName.process_overflow_repayments)
  async handleRepaymentOverflow(job: Job<ResolveRepayment>) {
    await this.privateHandleRepayments({ ...job.data, _updated: false });
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

    await this.privateHandleRepayments({ ...job.data, period, _updated: true });

    await this.prisma.liquidationRequest.update({
      where: { id: job.data.liquidationRequestId },
      data: { status: 'APPROVED' },
    });
  }

  private async privateHandleRepayments(dto: PrivateRepaymentHandler) {
    const {
      period,
      userId,
      allowPenalty,
      amount,
      repaymentId,
      resolutionNote,
      _updated,
    } = dto;

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
      },
      orderBy: { disbursementDate: 'asc' },
    });

    if (activeUserLoans.length === 0) return;

    let repaymentBalance = amount;
    let totalPaid = new Prisma.Decimal(0);
    let totalRepayable = new Prisma.Decimal(0);

    for (const loan of activeUserLoans) {
      const totalTenure = loan.loanTenure + loan.extension;

      const monthlyRepayment = loan.amountRepayable.div(totalTenure);
      const monthsSinceDisbursement = differenceInMonths(
        periodInDT,
        loan.disbursementDate!,
      );
      const periodsDue = Math.min(monthsSinceDisbursement + 1, totalTenure);

      const amountExpected = monthlyRepayment.mul(periodsDue);
      const amountDue = amountExpected.sub(loan.amountRepaid);
      if (amountDue.lte(0)) continue;

      let repaymentAmount = Prisma.Decimal(0);
      let penaltyCharge = Prisma.Decimal(0);

      if (allowPenalty && amountDue.gt(repaymentBalance)) {
        const penaltyRate = await this.config.getValue('PENALTY_FEE_RATE');
        if (!penaltyRate) return;

        const potentialPenalty = amountDue.mul(Prisma.Decimal(penaltyRate));

        penaltyCharge = Prisma.Decimal.min(potentialPenalty, repaymentBalance);
        repaymentAmount = repaymentBalance.sub(penaltyCharge);
      } else {
        repaymentAmount = Prisma.Decimal.min(repaymentBalance, amountDue);
      }

      if (repaymentAmount.lte(0)) break;

      const status =
        repaymentAmount.eq(amountDue) && penaltyCharge.eq(0)
          ? 'FULFILLED'
          : 'PARTIAL';

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

      const amountRepaid = loan.amountRepaid.add(repaymentAmount);
      const newAmountRepayable = loan.amountRepayable.add(penaltyCharge);
      const updatedLoan = await this.prisma.loan.update({
        where: { id: loan.id },
        data: {
          amountRepaid,
          ...(amountRepaid.gte(newAmountRepayable) && { status: 'REPAID' }),
          penaltyAmount: {
            increment: penaltyCharge,
          },
          amountRepayable: {
            increment: penaltyCharge,
          },
        },
        select: {
          amount: true,
          status: true,
          amountRepayable: true,
          penaltyAmount: true,
        },
      });

      await this.config.topupValue('TOTAL_REPAID', repaymentAmount.toNumber());
      if (updatedLoan.status === 'REPAID') {
        const interestRateRevenue = updatedLoan.amountRepayable.sub(
          updatedLoan.amount,
        );
        await Promise.all([
          this.config.topupValue(
            'INTEREST_RATE_REVENUE',
            interestRateRevenue.toNumber(),
          ),
          this.config.topupValue(
            'PENALTY_FEE_REVENUE',
            updatedLoan.penaltyAmount.toNumber(),
          ),
        ]);
      }

      repaymentBalance = repaymentBalance.sub(
        repaymentAmount.add(penaltyCharge),
      );
      totalPaid = totalPaid.add(repaymentAmount);
      totalRepayable = totalRepayable.add(updatedLoan.amountRepayable);
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
