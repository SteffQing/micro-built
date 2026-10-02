type CashLoanQuery = PaginatedApiQuery & {
  status?: LoanStatus;
  category?: LoanCategory;
  search?: string;
  principalMin?: number;
  principalMax?: number;
  hasPenalties?: boolean;
  hasCommodityLoan?: boolean;
  disbursementStart?: string;
  disbursementEnd?: string;
  requestedStart?: string;
  requestedEnd?: string;
};

type CommodityLoanQuery = PaginatedApiQuery & {
  search?: string;
  status?: CommodityRequestStatus;
  requestedStart?: string;
  requestedEnd?: string;
};

type LoanTerms = {
  tenure: number;
};

type AcceptCommodityLoan = {
  publicDetails: string;
  privateDetails: string;
  amount: number;
  tenure?: number;
  monthsDelta?: number;
};

type TopupQuery = PaginatedApiQuery & {
  status?: LoanStatus;
};

type RejectLoanDto = {
  note?: string;
};
