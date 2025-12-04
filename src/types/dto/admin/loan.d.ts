type CashLoanQuery = PaginatedApiQuery & {
  status?: LoanStatus;
  from?: Date | string;
  to?: Date | string;
};

type CommodityLoanQuery = PaginatedApiQuery & {
  search?: string;
  inReview?: boolean;
  from?: Date | string;
  to?: Date | string;
};

type LoanTerms = {
  tenure: number;
};

type AcceptCommodityLoan = {
  publicDetails: string;
  privateDetails: string;
  amount: number;
  tenure: number;
  managementFeeRate: number;
};
