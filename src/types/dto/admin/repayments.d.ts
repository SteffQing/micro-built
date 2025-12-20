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
	search?: string;
	variantMin?: number;
	variantMax?: number;
	periodStart?: string;
	periodEnd?: string;
	isRepaid?: boolean;
	expectedMin?: number;
	expectedMax?: number;
};

type FilterLiquidationRequestsDto = PaginatedApiQuery & {
	status?: LiquidationStatus;
};

type ManualRepaymentResolutionDto = {
	resolutionNote: string;

	userId?: string;

	loanId?: string;
};
