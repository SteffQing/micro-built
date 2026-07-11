type UploadRepaymentDto = {
  file: File;
};

type PeriodDto = {
  period: string;
};

type GenerateMonthlyLoanScheduleDto = PeriodDto & {
  email: string;
  save?: boolean;
};

type FilterRepayments = PaginatedApiQuery & {
  status?: RepaymentStatus;
  search?: string;
  hasPenaltyCharge?: boolean;
  periodStart?: string;
  periodEnd?: string;
  repaidAmountMin?: number;
  repaidAmountMax?: number;
};

type FilterLiquidationRequestsDto = PaginatedApiQuery & {
  status?: LiquidationStatus;
};

type ManualRepaymentResolutionDto = {
  resolutionNote: string;

  userId?: string;

  loanId?: string;
};

type RepaymentValidationInvalidRow = {
  row: number;
  staffId: string;
  issues: string[];
};

type RepaymentValidationResult = {
  period: string | null;
  headers: {
    valid: boolean;
    missing: string[];
  };
  rows: {
    valid: boolean;
    totalRows: number;
    invalidRows: RepaymentValidationInvalidRow[];
  } | null;
};
