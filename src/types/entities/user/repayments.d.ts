type UserRepaymentHistoryDto = {
  id: string;
  repaid: number;
  expected: number;
  status: RepaymentStatus;
  period: string;
  date: Date;
  loanId: string | null;
};

type UserRepaymentOverviewDto = {
  repaymentsCount: number;
  flaggedRepaymentsCount: number;
  lastRepayment: { amount: number; date: Date };
  nextRepaymentDate: Date;
  overdueAmount: number;
};

type UserRepaymentChartDto = {
  month: string;
  repaid: number;
};

type SingleUserRepaymentDto = {
  id: string;
  period: string;
  expectedAmount: number;
  repaidAmount: number;
  penaltyCharge: number;
  status: RepaymentStatus;
  loanId: string | null;
};
