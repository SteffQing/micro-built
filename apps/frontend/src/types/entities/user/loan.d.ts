type UserCashLoan = LoanFigures & {
  id: string;
  category: LoanCategory;
  status: LoanStatus;
  disbursementDate: Date | null;
  assetName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type UserCommodityLoan = {
  id: string;
  name: string;
  status: CommodityRequestStatus;
  kind: "NEW_LOAN" | "TOPUP";
  amount: number | null;
  details: string | null;
  date: Date;
};

type PendingLoan = {
  id: string;
  amount: number;
  category: LoanCategory;
  status: LoanStatus;
  date: Date;
};

type PendingLoanAndLoanCountResponseDto = {
  /** Loan requests not yet disbursed: PENDING or APPROVED. */
  pendingLoans: PendingLoan[];
  /** Top-ups not yet disbursed: PENDING or APPROVED. */
  pendingTopups: Array<{ id: string; loanId: string; amount: number; status: MicroLoanStatus; requestedAt: Date }>;
  commoditiesInReview: UserCommodityLoan[];
  rejectedCount: number;
  approvedCount: number;
  disbursedCount: number;
  repaidCount: number;
};

type AllUserLoansDto = {
  id: string;
  kind: "LOAN" | "TOPUP" | "COMMODITY";
  loanId: string;
  amount: number | null;
  category: LoanCategory;
  status: LoanStatus;
  name: string | null;
  date: Date;
};
