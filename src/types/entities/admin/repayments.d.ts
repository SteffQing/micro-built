type RepaymentOverviewDto = {
  totalExpected: number;
  totalOverdue: number;
  totalRepaid: number;
  underpaidCount: number;
  failedDeductionsCount: number;
};

type RepaymentUser = {
  id: string;
  name: string;
  repaymentRate: number;
  externalId: string | null;
};

type RepaymentsHistoryDto = {
  id: string;
  user: RepaymentUser | null;
  period: string;
  expectedAmount: number;
  repaidAmount: number;
  status: RepaymentStatus;
  loanId: string | null;
};

type SingleRepaymentWithUserDto = {
  id: string;
  loanId: string | null;
  period: string;
  expectedAmount: number;
  repaidAmount: number;
  status: RepaymentStatus;
  user: Pick<User, "id" | "name" | "repaymentRate"> | null;
  failureNote: string | null;
  resolutionNote: string | null;
};

type CustomerLiquidationsRequestDto = {
  status: LiquidationStatus;
  amount: number;
  id: string;
  approvedAt: Date | null;
};
