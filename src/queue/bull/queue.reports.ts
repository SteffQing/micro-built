import { Process, Processor } from '@nestjs/bull';
import { Prisma } from '@prisma/client';
import { Job } from 'bull';
import { addMonths, subDays } from 'date-fns';
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
import { calculateThisMonthPayment } from 'src/common/utils/shared-repayment.logic';
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
  async generateCustomerLoanReport(job: Job<ConsumerReport>) {
    const { userId, email } = job.data;
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, externalId: true, repaymentRate: true },
    });

    const loans = await this.getConsumerLoansHistory(userId);
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

    const summaries = this.generateCustomerLoanSummary(loans);

    const start = formatDateToReadable(reports[0][0].date);
    const end = formatDateToReadable(
      reports[reports.length - 1][reports[reports.length - 1].length - 1].date,
    );
    const pdfData = {
      ippisId: user.externalId || userId,
      customerName: user.name,
      paymentHistory,
      summaries,
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

  private async getConsumerLoansHistory(userId: string) {
    const loans = await this.prisma.loan.findMany({
      where: {
        borrowerId: userId,
        disbursementDate: { not: null },
      },
      orderBy: { disbursementDate: 'asc' },
      select: {
        amountBorrowed: true,
        interestRate: true,
        category: true,
        disbursementDate: true,
        activeLoanId: true,
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

    const grouped: Record<string, typeof loans> = {};
    for (const loan of loans) {
      if (!grouped[loan.activeLoanId!]) {
        grouped[loan.activeLoanId!] = [];
      }
      grouped[loan.activeLoanId!].push(loan);
    }

    const groupedLoans = Object.values(grouped);

    groupedLoans.forEach((group) =>
      group.sort(
        (a, b) =>
          new Date(a.disbursementDate!).getTime() -
          new Date(b.disbursementDate!).getTime(),
      ),
    ); // inner loans, sorted by oldest to newest

    groupedLoans.sort(
      (a, b) =>
        new Date(a[0].disbursementDate!).getTime() -
        new Date(b[0].disbursementDate!).getTime(),
    ); // outer loans, sorted by oldest to newest
    return groupedLoans;
  }

  private generateCustomerLoanSummary(
    loans: Awaited<ReturnType<typeof this.getConsumerLoansHistory>>,
  ) {
    const summaries: LoanSummary[] = loans.map((group) => {
      const first = group[0];
      const last = group[group.length - 1];

      const initialLoan = first.amountBorrowed.toNumber();
      const topUp = group.slice(1).map((loan) => ({
        amount: loan.amountBorrowed.toNumber(),
        date: loan.disbursementDate!,
      }));

      const [totalBorrowed, totalInterest] = group.reduce(
        (sum, { amountBorrowed, interestRate }) => {
          const interest = amountBorrowed.mul(interestRate);
          return [sum[0].add(amountBorrowed), sum[1].add(interest)];
        },
        [DECIMAL_ZERO, DECIMAL_ZERO],
      );
      const totalExpected = totalBorrowed.add(totalInterest);

      const allRepayments = group.flatMap((loan) => loan.repayments);
      const totalRepaid = allRepayments.reduce(
        (sum, { repaidAmount }) => sum.add(repaidAmount),
        DECIMAL_ZERO,
      );

      const balance = totalExpected.sub(totalRepaid);
      const status = balance.lte(DECIMAL_ZERO)
        ? 'completed'
        : totalRepaid.gt(DECIMAL_ZERO)
          ? 'active'
          : 'defaulted';

      return {
        initialLoan,
        topUp,
        totalLoan: totalBorrowed.toNumber(),
        totalInterest: totalInterest.toNumber(),
        totalPayable: totalExpected.toNumber(),
        // monthlyInstallment,
        paymentsMade: totalRepaid.toNumber(),
        balance: balance.toNumber(),
        status,
        start: first.disbursementDate!,
        end: last.disbursementDate!,
      };
    });

    return summaries;
  }

  private groupCustomerLoan(
    loans: Awaited<ReturnType<typeof this.getConsumerLoansHistory>>,
  ) {
    const reports: Array<CustomerLoanReport[]> = [];
    const paymentHistory: PaymentHistoryItem[] = [];

    for (const group of loans) {
      const allRepaymentsInThisGroup = group.flatMap((loan) => loan.repayments);
      const repaymentsByPeriod: Record<
        string,
        typeof allRepaymentsInThisGroup
      > = {};

      for (const repayment of allRepaymentsInThisGroup) {
        if (!repaymentsByPeriod[repayment.period]) {
          repaymentsByPeriod[repayment.period] = [];
        }
        repaymentsByPeriod[repayment.period].push(repayment);
      }

      const headers: Array<CustomerLoanReportHeader> = group.map((loan, i) => {
        const { interestRate, amountBorrowed, asset, category } = loan;
        const interestApplied = amountBorrowed.mul(interestRate);

        return {
          interestApplied: interestApplied.toNumber(),
          borrowedAmount: amountBorrowed.toNumber(),
          note: `${i === 0 ? 'New Loan Request' : 'Loan Topup'}, Reason: ${enumToHumanReadable(category)} ${asset?.name ? `(${asset.name})` : ''}`,
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

        if (isLoanEvent && row.note?.includes('New Loan Request')) continue;
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
    }

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
