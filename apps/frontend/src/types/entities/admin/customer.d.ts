type CustomerInfoDto = {
  id: string;
  name: string;
  email: string | null;
  status: UserStatus;
  flagReason: string | null;
  contact: string | null;
  avatar: string | null;
  repaymentRate: number;
};

type ActiveLoanDto = {
  id: string;
  amount: number;
  tenure: number;
  amountRepaid: number;
  amountOwed: number;
  category: LoanCategory;
  type: "New" | "Topup";
  status: LoanStatus;
  asset: { id: string; name: string } | null;
  createdAt: string;
  disbursementDate: string | null;
};

type PendingLoanDto = {
  id: string;
  detailsId: string;
  recordType: "LOAN" | "COMMODITY_REQUEST";
  category: LoanCategory;
  amount: number | null;
  date: Date;
  status: LoanStatus;
  type: "New" | "Topup";
  tenure: number | null;
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
  totalRepaid: number;
  totalPenalties: number;
  currentOverdue: number;
  totalLoanAmount: number;
  totalDisbursed: number;
  managementFee: number;
  interestEarned: number;
  interestReceived: number;
  penaltiesReceived: number;
  outstanding: number;
  activeLoansCount: number;
  pendingLoansCount: number;
  lastRepaymentDate: string | null;
  lastRepaymentPeriod: string | null;
};

type CustomerTopupHistoryDto = {
  id: string;
  loanId: string | null;
  obligationId: string | null;
  category: LoanCategory;
  assetName: string | null;
  status: LoanStatus;
  requestedAt: string;
  disbursedAt: string | null;
  requestedById: string | null;
  requestedByName: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  principal: number | null;
  amountAdded: number | null;
  outstandingBefore: number | null;
  contractualBefore: number | null;
  penaltyBefore: number | null;
  consolidatedOutstanding: number | null;
  consolidatedContractual: number | null;
  termBefore: number | null;
  selectedTerm: number | null;
  termAfter: number | null;
  monthlyBefore: number | null;
  monthlyAfter: number | null;
  effectiveFrom: string | null;
  planId: string | null;
  planHash: string | null;
  policyVersion: string | null;
};

type CustomerTenureChangeHistoryDto = {
  id: string;
  obligationId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedTermMonths: number;
  previousTermMonths: number;
  previousMonthly: number;
  proposedMonthly: number;
  balanceSnapshot: number;
  effectiveFromPeriod: string;
  reasonCode: string;
  note: string | null;
  requestedBy: string;
  requestedByName: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  rejectedBy: string | null;
  rejectedByName: string | null;
  createdAt: string;
  decidedAt: string | null;
  previewHash: string;
};

type CustomerLoanStatementDto = {
  id: string;
  obligationId: string;
  sequence: string;
  type: string;
  description: string;
  effectiveAt: string;
  recordedAt: string;
  actorType: string;
  actorId: string | null;
  actorName: string;
  reference: string;
  debit: number;
  credit: number;
  penaltyChange: number;
  contractualBalance: number;
  penaltyBalance: number;
  totalBalance: number;
  policyVersion: string | null;
  payloadHash: string;
};

type CustomerListItemDto = {
  id: string;
  name: string;
  email: string | null;
  contact: string | null;
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
};
