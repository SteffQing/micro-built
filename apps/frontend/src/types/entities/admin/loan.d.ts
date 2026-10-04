type BorrowerInLoanDto = {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  externalId: string | null;
};

type BorrowerCustomerInLoansDto = {
  id: string;
  name: string;
  externalId: string | null;
};

type CommodityLoanDto = {
  id: string;
  kind: "NEW_LOAN" | "TOPUP";
  name: string;
  status: CommodityRequestStatus;
  publicDetails: string | null;
  privateDetails: string | null;
  amount: number | null;
  loanId: string | null;
  loan: Omit<CashLoan, "borrower" | "category"> | null;
  borrower: BorrowerInLoanDto;
  loanStatus: LoanStatus;
  createdAt: Date;
};

type AssetInCashLoanDto = {
  id: string;
  name: string;
  status: CommodityRequestStatus;
  kind: "NEW_LOAN" | "TOPUP";
};

type CashLoan = LoanFigures & {
  id: string;
  category: LoanCategory;
  status: LoanStatus;
  disbursementDate: Date | null;
  interestRate: number;
  managementFeeRate: number;
  managementFee: number;
  createdAt: Date;
  updatedAt: Date;
  borrower: BorrowerInLoanDto;
  requestedBy: string | null;
  assets: AssetInCashLoanDto[];
  topups: Topup[];
};

type CashLoanItemDto = LoanFigures & {
  id: string;
  date: Date;
  customer: BorrowerCustomerInLoansDto;
  category: LoanCategory;
  status: LoanStatus;
};

type CommodityLoanItemDto = {
  id: string;
  date: Date;
  customer: BorrowerCustomerInLoansDto;
  name: string;
  status: CommodityRequestStatus;
  kind: "NEW_LOAN" | "TOPUP";
  amount: number | null;
  loanId: string | null;
  loanStatus: LoanStatus;
};

type TopupListItemDto = {
  id: string;
  loanId: string;
  customer: BorrowerCustomerInLoansDto;
  amount: number | null;
  status: LoanStatus;
  requestedAt: string;
  disbursedAt: string | null;
  tenureChange: {
    monthsDelta: number;
    status: TenureChangeStatus;
  } | null;
  asset: { id: string; name: string } | null;
};

type AdminTenureChangeDto = {
  id: string;
  loanId: string;
  customer: { id: string; name: string };
  reason: TenureChangeReason;
  status: TenureChangeStatus;
  monthsDelta: number;
  previousTenure: number;
  tenure: number;
  requestedBy: { id: string; name: string } | null;
  topupId: string | null;
  createdAt: string;
  decidedAt: string | null;
  note: string | null;
  netPay: number | null;
  cap: number | null;
  currentMonthly: number | null;
  proposedMonthly: number | null;
};

type AdminTopupDto = {
  id: string;
  loanId: string;
  customer: { id: string; name: string };
  amount: number | null;
  status: "PENDING" | "APPROVED" | "DISBURSED" | "REJECTED";
  requestedAt: string;
  disbursedAt: string | null;
  tenureChange: { monthsDelta: number; status: TenureChangeStatus } | null;
  asset: { id: string; name: string } | null;
};
