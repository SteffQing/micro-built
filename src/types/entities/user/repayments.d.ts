type UserRepaymentDto = {
  id: string;
  repaid: number;
  period: string;
  date: Date;
  loanId: string;
};

type UserRepaymentOverviewDto = {
  repaymentsCount: number;
  flaggedRepaymentsCount: number;
  lastRepaymentDate: Date;
  nextRepaymentDate: Date;
  overdueAmount: number;
};

type UserRepaymentChartDto = {
  month: string;
  repaid: number;
};
