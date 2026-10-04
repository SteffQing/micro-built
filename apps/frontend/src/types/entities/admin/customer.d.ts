type CustomerInfoDto = {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  image: string | null;
  externalId: string | null;
  status: UserStatus;
  flagReason: string | null;
  repaymentRate: number;
  accountOfficer: { id: string; name: string } | null;
  createdAt: string;
};

type ActiveLoanDto = LoanFigures & {
  id: string;
  category: LoanCategory;
  status: LoanStatus;
  disbursementDate: string | null;
  createdAt: string;
};

type PendingLoanDto = {
  id: string;
  detailsId: string;
  recordType: "LOAN" | "TOPUP" | "COMMODITY_REQUEST";
  loanId: string;
  kind: "NEW_LOAN" | "TOPUP";
  category: LoanCategory;
  amount: number | null;
  tenure: number | null;
  date: Date;
  status: LoanStatus;
  asset: { id: string; name: string } | null;
};

type UserLoansDto = {
  activeLoans: ActiveLoanDto[];
  pendingLoans: PendingLoanDto[];
  approvedLoans: PendingLoanDto[];
  applications: PendingLoanDto[];
};

type UserLoanSummaryDto = {
  totalBorrowed: number;
  totalLoanAmount: number;
  totalDisbursed: number;
  managementFee: number;
  interestBooked: number;
  interestCollected: number;
  penaltyCharged: number;
  penaltyCollected: number;
  totalRepaid: number;
  outstanding: number;
  activeLoansCount: number;
  pendingLoansCount: number;
  repaymentRate: number;
  lastRepaymentDate: string | null;
  lastRepaymentPeriod: string | null;
};

type CustomerTopupHistoryDto = {
  id: string;
  loanId: string | null;
  recordType: "TOPUP" | "ASSET_REQUEST";
  amount: number | null;
  status: LoanStatus;
  requestedAt: string;
  disbursedAt: string | null;
  asset: { id: string; name: string } | null;
  tenureChange: {
    monthsDelta: number;
    status: TenureChangeStatus;
  } | null;
};

type CustomerTenureChangeHistoryDto = {
  id: string;
  loanId: string;
  previousTenure: number;
  monthsDelta: number;
  tenure: number;
  reason: TenureChangeReason;
  status: TenureChangeStatus;
  topupId: string | null;
  requestedBy: string | null;
  createdAt: string;
};

type CustomerLoanStatementDto = {
  from: string;
  to: string;
  opening: number;
  closing: number;
  debits: number;
  credits: number;
  lines: AdminStatementLineDto[];
};

type CustomerListItemDto = {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  externalId: string | null;
  status: UserStatus;
  repaymentRate: number;
};

type CustomersOverviewDto = {
  activeCustomersCount: number;
  flaggedCustomersCount: number;
  customersWithActiveLoansCount: number;
  defaultedCount: number;
  flaggedCount: number;
  ontimeCount: number;
};

type CustomerPPI = {
  payroll: UserPayroll | null;
  identity: UserIdentity | null;
  paymentMethod: UserPaymentMethod | null;
};

type CustomerUserId = {
  userId: string;
  loanId: string | null;
  commodityLoanId: string | null;
};

type LoanStatementLineDto = {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

type LoanStatementDto = {
  from: string;
  to: string;
  opening: number;
  debits: number;
  credits: number;
  closing: number;
  lines: LoanStatementLineDto[];
};

type CustomerReportPreviewDto = {
  audience: "admin" | "customer";
  generatedAt: string;
  range: { from: string; to: string; fromLabel: string; toLabel: string };
  customer: { id: string; name: string; externalId: string | null; phoneNumber: string | null; email: string | null; organization: string | null; command: string | null; status: UserStatus };
  loans: Array<LoanFigures & { id: string; status: LoanStatus; category: LoanCategory; disbursementDate: string | null; commodity: { name: string; details: string } | null; topups: unknown[] }>;
  statement: { opening: number; debits: number; credits: number; closing: number; lines: AdminStatementLineDto[] };
  totals: { repaid: number; outstanding: number; repaymentRate: number };
  revenue?: { interestBooked: number; interestCollected: number; managementFee: number; penaltyCharged: number; penaltyCollected: number };
  accountOfficer?: { id: string; name: string } | null;
  notes?: { flagReason: string | null; history: Array<{ action: string; note: string; actorName: string; createdAt: string }> };
};
