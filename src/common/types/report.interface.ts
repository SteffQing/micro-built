import { Prisma } from '@prisma/client';

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
  save?: boolean;
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

export type ExportDataset =
  | 'customers'
  | 'cash_loans'
  | 'commodity_loans'
  | 'repayments';

export interface ExportListJob {
  dataset: ExportDataset;
  // Serialized list-filter DTO (same shape the paginated endpoints accept).
  filters: Record<string, any>;
  email: string;
  // When set, the export is scoped to this user's own records (user-side export).
  scopeUserId?: string;
}

interface SharedReportValue {
  date: Date;
  outstanding: number;
}

export interface CustomerLoanReportData extends SharedReportValue {
  totalDue: number;
  actualPayment: number;
  penaltyCharged: number;
}

export interface CustomerLoanReportHeader extends SharedReportValue {
  borrowedAmount: number;
  interestApplied: number;
  note: string;
}

export type CustomerLoanReport = Partial<CustomerLoanReportData> &
  Partial<CustomerLoanReportHeader> &
  SharedReportValue;

export type LoanSummary = {
  totalBorrowed: number;
  penaltiesCharged: number;
  totalInterest: number;
  paymentsMade: number;
  balance: number;
  status: 'active' | 'completed';
  start: Date;
  end: Date;
};

export type PaymentHistoryItem = {
  month: string;
  paymentDue: number;
  paymentMade: number;
  // datePaid: string;
  balanceAfter: number;
  remarks: string;
};
