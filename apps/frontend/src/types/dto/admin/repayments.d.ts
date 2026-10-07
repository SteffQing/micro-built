/** POST /admin/vouchers and /validate: one organization's repayment file; the month comes from the sheet. */
type UploadVoucherDto = {
  file: File;
  organizationId: string;
  period?: string;
};

/** An earlier variation of the same organization still waiting for its voucher (vouchers go in month order). */
type EarlierUnlockedVariation = {
  variationId: string;
  ym: string;
  label: string;
};

type FilterRepayments = PaginatedApiQuery & {
  state?: PaymentInflowState;
  source?: PaymentInflowSource;
  search?: string;
  from?: string;
  to?: string;
  amountMin?: number;
  amountMax?: number;
  customerId?: string;
  voucherId?: string;
};

type FilterLiquidationRequestsDto = PaginatedApiQuery & {
  state?: LiquidationStatus;
};

type ManualRepaymentResolutionDto = {
  action: "APPLY" | "SETTLE" | "REJECT";
  customerId?: string;
  note?: string;
};

type RepaymentValidationInvalidRow = {
  row: number;
  staffId: string;
  issues: string[];
};

type RepaymentValidationResult = {
  valid: boolean;
  period: string | null;
  rows: number;
  missingColumns: string[];
  problems: string[];
  invalidRows: RepaymentValidationInvalidRow[];
  /** The organization picked for the voucher. */
  organization: { id: string; name: string };
  /** The variation it lands in; null when that month's variation hasn't been generated. */
  variation: { id: string; version: number } | null;
  /** Rows that will need an admin: no customer with that staff id, a customer in another organization, a loan not in the variation. */
  issues: { unmatched: number; otherOrganization: number; notInVariation: number };
  earlierUnlocked: EarlierUnlockedVariation[];
  /** Why the upload would be refused (no variation, already locked, file seen before…). */
  conflicts: string[];
};

/** PATCH /admin/repayments/inflows/:id/manual-resolution */
type ManualResolutionResultDto = {
  id: string;
  state: PaymentInflowState;
  customerId: string | null;
  loanId: string | null;
  applied: number;
  unapplied: number;
  deductionStatus: DeductionStatus | null;
  /** A rematch undid the penalty the voucher charged this loan (PLAN_V2 R4b). */
  penaltyCleared: boolean;
  /** Why a rematch couldn't clear it (the penalty stays), or null. */
  fallbackReason: string | null;
};

type AcceptLiquidationDto = {
  note?: string;
};

type RejectLiquidationDto = {
  /** Required: why it was rejected (audit log, and shown to the customer). */
  note: string;
};

type FilterDeductions = PaginatedApiQuery & {
  /** One payroll month (YYYY-MM); replaces from/to. */
  period?: string;
  from?: string;
  to?: string;
  status?: DeductionStatus;
  search?: string;
  customerId?: string;
};

type FilterAppliedRepayments = PaginatedApiQuery & {
  period?: string;
  from?: string;
  to?: string;
  search?: string;
  customerId?: string;
  loanId?: string;
};
