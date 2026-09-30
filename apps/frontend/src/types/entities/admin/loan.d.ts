type BorrowerInLoanDto = {
  id: string;
  name: string;
  email: string | null;
  contact: string | null;
  externalId: string | null;
};

type BorrowerCustomerInLoansDto = {
  id: string;
  name: string;
  externalId: string | null;
};

type CommodityLoanDto = {
  id: string;
  type: "New" | "Topup";
  targetObligationId: string | null;
  name: string;
  inReview: boolean;
  publicDetails: string | null;
  privateDetails: string | null;
  loanId: string | null;
  loan: Omit<CashLoan, "borrower" | "category"> | null;
  borrower: BorrowerInLoanDto;
  createdAt: Date;
};

type AssetInCashLoanDto = {
  id: string;
  name: string;
};

type CashLoan = {
  id: string;
  type: "New" | "Topup";
  amount: number;
  repayable: number;
  amountRepaid: number;
  amountOwed: number;
  penalty: number;
  penaltyPaid: number;
  managementFeeRate: number;
  interestRate: number;
  status: LoanStatus;
  category: LoanCategory;
  disbursementDate: Date | null;
  tenure: number;
  createdAt: Date;
  updatedAt: Date;
  borrower: BorrowerInLoanDto;
  asset: AssetInCashLoanDto | null;
};

type CashLoanItemDto = {
  id: string;
  date: Date;
  amount: number;
  amountRepaid: number;
  penalty: number;
  customer: BorrowerCustomerInLoansDto;
  category: LoanCategory;
  loanTenure: number;
  status: LoanStatus;
};

type CommodityLoanItemDto = {
  id: string;
  date: Date;
  customer: BorrowerCustomerInLoansDto;
  name: string;
  amount: number | null;
  loanId: string | null;
  status: LoanStatus;
};

// type UserActiveLoan = {
//   id: string;
//   amount: number;
//   repaid: number;
//   tenure: number;
//   disbursementDate: Date;
// };

type UserActiveLoan = {
  id: string;
  obligationId?: string;
  version?: number;
  totalBalance: number;
  totalPenaltyOwed: number;
  totalOutstanding?: number;
  tenureLeft: number;
  monthlyRepayment?: number;
  planStartDate?: Date;
  planEndDate?: Date | null;
  planId?: string;
  planVersion?: number;
};

type RepaymentPlanSummaryDto = {
  id: string;
  version: number;
  termMonths: number;
  scheduledBalance: number;
  penaltyBalance: number;
  scheduledMonthly: number;
  effectiveFromPeriod: Date;
};

type RepaymentObligationDto = {
  id: string;
  borrowerId: string;
  status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "SETTLED" | "CLOSED";
  version: number;
  contractualOutstanding: number;
  penaltyOutstanding: number;
  creditBalance: number;
  currentPlan: RepaymentPlanSummaryDto | null;
};

type RepaymentPlanHistoryDto = RepaymentPlanSummaryDto & {
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED" | "CANCELLED";
  reason: "INITIAL_DISBURSEMENT" | "TOPUP" | "DEFAULT_EXTENSION" | "OVERPAYMENT" | "MANUAL_TENURE_CHANGE" | "MANUAL_RESTRUCTURE" | "LIQUIDATION" | "REVERSAL" | "MIGRATION_BASELINE";
  policyName: string;
  policyVersion: string;
  createdBy: string;
  createdAt: string;
  publishedAt: string | null;
  supersededAt: string | null;
  inputHash: string;
};

type ObligationAuditEventDto = {
  id: string;
  sequence: string;
  type: string;
  effectiveAt: string;
  recordedAt: string;
  actorType: string;
  actorId: string | null;
  policyVersion: string | null;
  correlationId: string;
  payloadHash: string;
  payload: Record<string, unknown>;
};

type TenureChangePreviewDto = {
  obligationId: string;
  obligationVersion: number;
  previousPlanId: string;
  previousTermMonths: number;
  previousMonthly: string;
  contractualOutstanding: string;
  penaltyOutstanding: string;
  proposedTermMonths: number;
  proposedMonthly: string;
  effectiveFromPeriod: string;
  endDate: string;
  policyVersion: string;
  previewHash: string;
};

type TenureChangeRequestDto = {
  termMonths: number;
  reasonCode: string;
  note?: string;
  expectedObligationVersion: number;
};
