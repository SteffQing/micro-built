type RepaymentOverviewDto = {
  totalExpected: number;
  totalRepaid: number;
  underpaymentsCount: number;
  failedDeductionsCount: number;
};

type RepaymentsResponseDto = {
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
