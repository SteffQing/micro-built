type UserRepaymentHistoryDto = {
  id: string;
  repaid: number;
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
