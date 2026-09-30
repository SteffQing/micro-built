type UserCashLoan = {
  amountRepayable: number;
  amountRepaid: number;
  amount: number;
  assetName: string | null;
  assetId: string | null;
  id: string;
  status: LoanStatus;
  category: LoanCategory;
  disbursementDate: Date | null;
  tenure: number;
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

type AllUserLoansDto = {
  id: string;
  date: Date;
  amount?: number;
  category: LoanCategory;
  status: LoanStatus;
  name?: string;
};

type AllUserCommodityLoanDto = {
  date: Date;
  id: string;
  name: string;
};
