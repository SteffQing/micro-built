import { LoanCategory, Prisma } from '@prisma/client';

export interface UserLoans {
  loanBalance: Prisma.Decimal;
  amount: Prisma.Decimal;
  tenure: number;
  startDate: Date;
  endDate: Date;
}

export interface GenerateMonthlyLoanSchedule {
  period: string;
  email: string;
}

export interface ScheduleVariation {
  externalId: string;
  name: string;
  command: string;
  balance: number;
  expected: number;
  tenure: number;
  start: Date;
  end: Date;
}

export interface ConsumerReport {
  email: string;
  userId: string;
}

interface SharedReportValue {
  date: Date;
  outstanding: number;
}

export interface CustomerLoanReportData extends SharedReportValue {
  totalDue: number;
  actualPayment: number;
}

export interface CustomerLoanReportHeader extends SharedReportValue {
  borrowedAmount: number;
  interestApplied: number;
  note: string;
}

export type CustomerLoanReport = Partial<CustomerLoanReportData> &
  Partial<CustomerLoanReportHeader> &
  SharedReportValue;
