type UserCashLoan = LoanFigures & {
  id: string;
  category: LoanCategory;
  status: LoanStatus;
  disbursementDate: Date | null;
  assetName: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** GET /user/loans/:loanId only. */
  topups?: UserLoanTopup[];
};

type UserLoanTopup = {
  id: string;
  amount: number;
  status: MicroLoanStatus;
  requestedAt: Date;
  disbursedAt: Date | null;
  tenureChange: { monthsDelta: number; status: TenureChangeStatus } | null;
};

type UserMicroLoan = {
  id: string;
  loanId: string;
  /** NEW_LOAN: the loan as first paid out. TOPUP: added to it later. */
  purpose: "NEW_LOAN" | "TOPUP";
  amount: number;
  status: MicroLoanStatus;
  requestedAt: Date;
  disbursedAt: Date | null;
  assetName: string | null;
  loanCategory: LoanCategory;
  tenureChange: { monthsDelta: number; status: TenureChangeStatus } | null;
};

type UserCommodityLoan = {
  id: string;
  name: string;
  status: CommodityRequestStatus;
  kind: "NEW_LOAN" | "TOPUP";
  amount: number | null;
  details: string | null;
  date: Date;
  /** Past review: APPROVED waits to be paid out, DELIVERED was paid out. */
  stage: "IN_REVIEW" | "APPROVED" | "DELIVERED" | "REJECTED";
  microLoanId: string | null;
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
