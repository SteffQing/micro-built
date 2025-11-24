import { Process, Processor } from '@nestjs/bull';
import { Prisma } from '@prisma/client';
import { Job } from 'bull';
import { addMonths, subDays, max, differenceInMonths } from 'date-fns';
import { groupBy } from 'lodash';
import { QueueName } from 'src/common/types';
import { ReportQueueName } from 'src/common/types/queue.interface';
import {
  ConsumerReport,
  CustomerLoanReport,
  CustomerLoanReportData,
  CustomerLoanReportHeader,
  GenerateMonthlyLoanSchedule,
  LoanSummary,
  PaymentHistoryItem,
  ScheduleVariation,
} from 'src/common/types/report.interface';
import {
  parseDateToPeriod,
  parsePeriodToDate,
  enumToHumanReadable,
  formatDateToReadable,
  formatDateToDmy,
} from 'src/common/utils';
import { calculateAmortizedPayment } from 'src/common/utils/shared-repayment.logic';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { MailService } from 'src/notifications/mail.service';
import generateLoanReportPDF from 'src/notifications/templates/CustomerReportPDF';
import * as XLSX from 'xlsx';

const DECIMAL_ZERO = new Prisma.Decimal(0);

@Processor(QueueName.reports)
export class GenerateReports {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: MailService,
    private readonly supabase: SupabaseService,
  ) {}

  @Process(ReportQueueName.schedule_variation)
  async generateScheduleVariation(job: Job<GenerateMonthlyLoanSchedule>) {
    const { period, email } = job.data;
    const loanData = await this.generateLoanData();
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
        'START DATE': formatDateToDmy(data.start),
        'END DATE': formatDateToDmy(data.end),
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

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    await this.email.sendLoanScheduleReport(
      email,
      {
        period,
        len: loanData.length,
        amount: loanData.reduce((acc, cur) => acc + cur.expected, 0),
      },
      buffer,
    );
    await job.progress(90);

    await this.supabase.uploadVariationScheduleDoc(buffer, period);
    await job.progress(100);
  }

  private async generateLoanData() {
    const loans = await this.prisma.loan.findMany({
      where: { status: 'DISBURSED' },
      select: {
        principal: true,
        penalty: true,
        interestRate: true,
        tenure: true,
        disbursementDate: true,
        repaid: true,
        extension: true,
        borrower: {
          select: {
            externalId: true,
            name: true,
            payroll: { select: { command: true, organization: true } },
          },
        },
      },
      orderBy: { disbursementDate: 'asc' },
    });

    const loansByUser = groupBy(loans, (loan) => loan.borrower.externalId);
    const data: ScheduleVariation[] = [];

    Object.values(loansByUser).forEach((loans) => {
      const { borrower, disbursementDate } = loans[0];

      if (!borrower || !borrower.payroll) {
        return;
      }

      const aggregate = loans.map((loan) => {
        const principal = Number(loan.principal.add(loan.penalty));
        const months = loan.tenure + loan.extension;
        const rate = loan.interestRate.toNumber();

        const owed = calculateAmortizedPayment(principal, rate, months);
        const totalPayable = owed * months;

        const endDate = subDays(addMonths(loan.disbursementDate!, months), 1);
        const balance = totalPayable - loan.repaid.toNumber();

        return { owed, endDate, balance, months };
      });

      const endDate = max(...aggregate.map((agg) => agg.endDate));

      data.push({
        externalId: borrower.externalId!,
        name: borrower.name,
        command: borrower.payroll.command,
        tenure: differenceInMonths(endDate, disbursementDate!),
        start: disbursementDate!,
        end: endDate,
        expected: aggregate.reduce((acc, tot) => acc + tot.owed, 0),
        balance: aggregate.reduce((acc, tot) => acc + tot.balance, 0),
      });
    });

    return data;
  }

  @Process(ReportQueueName.customer_report)
  async generateCustomerLoanReport(job: Job<ConsumerReport>) {
    const { userId, email } = job.data;
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, externalId: true, repaymentRate: true },
    });

    const loans = await this.getConsumerLoans(userId);
    await job.progress(30);

    const { reports, paymentHistory } = this.groupCustomerLoan(loans);
    await job.progress(40);

    const reportData = this.generateCustomerReport(reports);
    const sheetData: any[][] = [
      [`Customer Name: ${user.name}`],
      [`Customer IPPIS NO.: ${user.externalId}`],
      [`Customer Repayment Rate: ${user.repaymentRate}%`],
      [],
      ...reportData,
    ];

    const summary = this.generateCustomerLoanSummary(loans);

    const start = formatDateToReadable(summary.start);
    const end = formatDateToReadable(summary.end);
    const pdfData = {
      ippisId: user.externalId || userId,
      customerName: user.name,
      paymentHistory,
      summary,
      start,
      end,
    };
    const pdfBuffer = await generateLoanReportPDF(pdfData);

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Loan Report');

    const details = {
      name: user.name,
      id: user.externalId || userId,
      start,
      end,
      count: reports.length,
    };

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    await this.email.sendCustomerLoanReport(email, details, buffer, pdfBuffer);

    return pdfBuffer;
  }

  private async getConsumerLoans(userId: string) {
    const loans = await this.prisma.loan.findMany({
      where: {
        borrowerId: userId,
        disbursementDate: { not: null },
      },
      orderBy: { disbursementDate: 'asc' },
      select: {
        principal: true,
        penalty: true,
        repaid: true,
        interestRate: true,
        category: true,
        disbursementDate: true,
        tenure: true,
        extension: true,
        type: true,
        asset: { select: { name: true } },
        repayments: {
          select: {
            period: true,
            expectedAmount: true,
            repaidAmount: true,
            penaltyCharge: true,
          },
        },
      },
    });

    return loans.sort(
      (a, b) =>
        new Date(a.disbursementDate!).getTime() -
        new Date(b.disbursementDate!).getTime(),
    );
  }

  private generateCustomerLoanSummary(
    loans: Awaited<ReturnType<typeof this.getConsumerLoans>>,
  ) {
    const aggregate = loans.reduce(
      (acc, loan) => {
        const principal = Number(loan.principal.add(loan.penalty));
        const months = loan.tenure + loan.extension;
        const rate = loan.interestRate.toNumber();

        const pmt = calculateAmortizedPayment(principal, rate, months);
        const interest = pmt * months - principal;

        const totalPayable = pmt * months;
        const balance = new Prisma.Decimal(totalPayable).sub(loan.repaid);

        return {
          totalBorrowed: acc.totalBorrowed.add(loan.principal),
          penaltiesCharged: acc.penaltiesCharged.add(loan.penalty),
          totalInterest: acc.totalInterest.add(interest),
          balance: acc.balance.add(balance),
          paymentsMade: acc.paymentsMade.add(loan.repaid),
        };
      },
      {
        totalBorrowed: DECIMAL_ZERO,
        penaltiesCharged: DECIMAL_ZERO,
        totalInterest: DECIMAL_ZERO,
        balance: DECIMAL_ZERO,
        paymentsMade: DECIMAL_ZERO,
      },
    );

    const status: 'completed' | 'active' = aggregate.balance.lte(DECIMAL_ZERO)
      ? 'completed'
      : 'active';

    return {
      totalBorrowed: aggregate.totalBorrowed.toNumber(),
      penaltiesCharged: aggregate.penaltiesCharged.toNumber(),
      totalInterest: aggregate.totalInterest.toNumber(),
      paymentsMade: aggregate.paymentsMade.toNumber(),
      balance: aggregate.balance.toNumber(),
      status: status,
      start: loans[0].disbursementDate!,
      end: new Date(),
    };
  }

  private groupCustomerLoan(
    loans: Awaited<ReturnType<typeof this.getConsumerLoans>>,
  ) {
    const reports: Array<CustomerLoanReport[]> = [];
    const paymentHistory: PaymentHistoryItem[] = [];

    const allRepaymentsInThisGroup = loans.flatMap((loan) => loan.repayments);
    const repaymentsByPeriod: Record<string, typeof allRepaymentsInThisGroup> =
      {};

    for (const repayment of allRepaymentsInThisGroup) {
      if (!repaymentsByPeriod[repayment.period]) {
        repaymentsByPeriod[repayment.period] = [];
      }
      repaymentsByPeriod[repayment.period].push(repayment);
    }

    const headers: Array<CustomerLoanReportHeader> = loans.map((loan, i) => {
      const { asset, category } = loan;

      const principal = Number(loan.principal.add(loan.penalty));
      const months = loan.tenure + loan.extension;
      const rate = loan.interestRate.toNumber();

      const pmt = calculateAmortizedPayment(principal, rate, months);
      const interestApplied = pmt * months - principal;

      return {
        interestApplied: interestApplied,
        borrowedAmount: loan.principal.toNumber(),
        note: `${loan.type} Loan: ${enumToHumanReadable(category)} ${asset?.name ? `(${asset.name})` : ''}`,
        date: loan.disbursementDate!,
        outstanding: 0,
      };
    });

    const repayments: Array<CustomerLoanReportData> = Object.values(
      repaymentsByPeriod,
    ).map((repayments) => {
      const due = repayments.reduce(
        (sum, { penaltyCharge, expectedAmount }) =>
          sum.add(expectedAmount).add(penaltyCharge),
        DECIMAL_ZERO,
      );
      const paid = repayments.reduce(
        (sum, { repaidAmount }) => sum.add(repaidAmount),
        DECIMAL_ZERO,
      );

      return {
        totalDue: due.toNumber(),
        actualPayment: paid.toNumber(),
        date: parsePeriodToDate(repayments[0].period),
        outstanding: 0,
      };
    });

    const combined: Array<CustomerLoanReport> = [...headers, ...repayments];
    combined.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningOutstanding = 0;
    for (const row of combined) {
      if (row.borrowedAmount && row.interestApplied) {
        runningOutstanding += row.borrowedAmount + row.interestApplied;
      }
      if (row.actualPayment) {
        runningOutstanding -= row.actualPayment;
      }
      row.outstanding = runningOutstanding;

      const isRepayment = 'totalDue' in row || 'actualPayment' in row;
      const isLoanEvent = 'borrowedAmount' in row && 'interestApplied' in row;

      if (isLoanEvent && row.note?.includes('New Loan')) continue;
      const item: PaymentHistoryItem = {
        month: parseDateToPeriod(row.date),
        paymentDue: isRepayment ? (row.totalDue ?? 0) : 0,
        paymentMade: isRepayment ? (row.actualPayment ?? 0) : 0,
        balanceAfter: runningOutstanding,
        remarks: isLoanEvent
          ? row.note!
          : row.actualPayment === 0
            ? 'Default (Missed)'
            : (row.actualPayment ?? 0) < (row.totalDue ?? 0)
              ? 'Partially paid'
              : 'On Time',
      };

      paymentHistory.push(item);
    }

    reports.push(combined);

    return { reports, paymentHistory };
  }

  private generateCustomerReport(reports: CustomerLoanReport[][]) {
    const sheetData: any[][] = [];

    sheetData.push([
      'Date',
      'Note',
      'Borrowed Amount',
      'Interest Applied',
      'Total Due',
      'Actual Payment',
      'Outstanding',
    ]);

    for (const group of reports) {
      for (const row of group) {
        const isHeader = row.borrowedAmount !== undefined;

        if (isHeader) {
          sheetData.push([
            formatDateToReadable(row.date),
            row.note,
            row.borrowedAmount ?? '',
            row.interestApplied ?? '',
            '',
            '',
            row.outstanding,
          ]);
          sheetData.push([]);
        } else {
          sheetData.push([
            formatDateToReadable(row.date),
            'Repayment',
            '',
            '',
            row.totalDue ?? '',
            row.actualPayment ?? '',
            row.outstanding,
          ]);
        }
      }

      sheetData.push([]);
      sheetData.push([]);
    }

    return sheetData;
  }
}
