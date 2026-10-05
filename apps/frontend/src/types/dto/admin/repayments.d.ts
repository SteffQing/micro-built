type UploadRepaymentDto = {
  file: File;
  period?: string;
};

type PeriodDto = {
  period: string;
};

type ClosePeriodDto = {
  period: string;
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
  uploadId?: string;
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
};

type AcceptLiquidationDto = {
  note?: string;
};

type RejectLiquidationDto = {
  note?: string;
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
