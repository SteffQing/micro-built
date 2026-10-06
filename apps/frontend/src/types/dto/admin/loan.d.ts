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
  /** Top-up only, with monthsDelta > 0: book interest on the running loan for the added months. */
  reprice?: boolean;
};

type TopupQuery = PaginatedApiQuery & {
  status?: LoanStatus;
};

type RejectLoanDto = {
  note?: string;
};
