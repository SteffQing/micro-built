type RepaymentOverviewDto = {
  totalExpected: number;
  totalOverdue: number;
  totalRepaid: number;
  underpaidCount: number;
  failedDeductionsCount: number;
};

type RepaymentsHistoryDto = {
  id: string;
  userId: string;
  period: string;
  expectedAmount: number;
  repaidAmount: number;
  status: RepaymentStatus;
};

type SingleRepaymentWithUserDto = {
  id: string;
  userId: string;
  period: string;
  expectedAmount: number;
  repaidAmount: number;
  status: RepaymentStatus;
  userName: string;
};
