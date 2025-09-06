type UploadRepaymentDto = {
  file: File;
  period: string;
};

type GenerateMonthlyLoanScheduleDto = {
  period: string;
  email: string;
};

type FilterRepayments = PaginatedApiQuery & {
  status?: RepaymentStatus;
};

type FilterLiquidationRequestsDto = PaginatedApiQuery & {
  status?: LiquidationStatus;
};

type ManualRepaymentResolutionDto = {
  resolutionNote: string;

  userId?: string;

  loanId?: string;
};
