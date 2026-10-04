type UserRepaymentHistoryDto = {
  id: string;
  loanId: string | null;
  amount: number;
  date: Date;
  period: string;
  source: PaymentInflowSource;
  expected: number | null;
  deductionStatus: DeductionStatus | null;
};

type UserRepaymentOverviewDto = {
  totalRepaid: number;
  outstanding: number;
  repaymentsCount: number;
  missedCount: number;
  thisMonth: { amount: number; period: string } | null;
  lastRepayment: {
    amount: number;
    date: Date;
    period: string;
    source: PaymentInflowSource;
  } | null;
  chart: Array<{ period: string; amount: number }>;
};

type UserRepaymentChartDto = {
  period: string;
  amount: number;
};

type SingleUserRepaymentDto = {
  id: string;
  loanId: string | null;
  period: string;
  amount: number;
  source: PaymentInflowSource;
  expected: number | null;
  deductionStatus: DeductionStatus | null;
};

type LiquidationPreviewDto = {
  loanId: string;
  owed: number;
  repaid: number;
  outstanding: number;
  penaltyOutstanding: number;
  interestOutstanding: number;
  principalOutstanding: number;
  remainingMonths: number;
  monthly: number | null;
  endPeriod: string | null;
};

type UserLiquidationDto = {
  id: string;
  amount: number;
  state: "AWAITING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  decidedAt: string | null;
  note: string | null;
  hasProof: boolean;
};

type StatementLineDto = {
  date: string;
  loanId: string;
  reference: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

type AdminStatementLineDto = StatementLineDto & {
  managementFee: number;
  split: { principal: number; interest: number; penalty: number } | null;
};

type UserStatementDto = {
  from: string;
  to: string;
  opening: number;
  debits: number;
  credits: number;
  closing: number;
  lines: StatementLineDto[];
};
