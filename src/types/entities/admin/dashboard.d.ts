type DashboardOverviewDto = {
  activeCount: number;
  pendingCount: number;
  totalDisbursed: number;
  grossProfit: number;
};

type DisbursementChartEntryDto = Record<
  string,
  {
    total: number;
    categories: Record<LoanCategory, number>;
  }
>;

type CashLoanRequestDto = {
  customerId: string;
  id: string;
  amount: number;
  category: LoanCategory;
  requestedAt: Date;
};

type CommodityLoanRequestDto = {
  customerId: string;
  id: string;
  name: string;
  category: LoanCategory;
  requestedAt: Date;
};

type OpenLoanRequestsDto = {
  cashLoans: CashLoanRequestDto[];
  commodityLoans: CommodityLoanRequestDto[];
};

type LoanReportOverviewDto = {
  totalDisbursed: number;
  totalRepaid: number;
  interestEarned: number;
  activeLoansCount: number;
  pendingLoansCount: number;
};

type LoanReportStatusDistributionDto = {
  statusCounts: Record<LoanStatus, number>;
};
