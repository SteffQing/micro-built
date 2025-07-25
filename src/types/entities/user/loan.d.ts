type UserCashLoan = {
  repayable: number;
  amount: number;
  assetName: string | undefined;
  assetId: string | undefined;
  id: string;
  status: LoanStatus;
  category: LoanCategory;
  disbursementDate: Date | null;
  loanTenure: number;
  extension: number;
  createdAt: Date;
  updatedAt: Date;
};

type UserCommodityLoan = {
  details: string | null;
  date: Date;
  id: string;
  name: string;
  inReview: boolean;
};

type PendingLoan = {
  amount: number;
  id: string;
  date: Date;
};

type PendingLoanAndLoanCountResponseDto = {
  pendingLoans: PendingLoan[];
  rejectedCount: number;
  approvedCount: number;
  disbursedCount: number;
};
