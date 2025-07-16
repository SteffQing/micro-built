type DashboardOverviewDto = {
  activeCount: number;
  pendingCount: number;
  totalDisbursed: number;
  grossProfit: number;
};

type DisbursementChartEntryDto = {
  month: string;
  EDUCATION: number;
  PERSONAL: number;
  BUSINESS: number;
  MEDICAL: number;
  RENT: number;
  TRAVEL: number;
  AGRICULTURE: number;
  UTILITIES: number;
  EMERGENCY: number;
  OTHERS: number;
  ASSET_PURCHASE: number;
};

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

type OpenLoanRequestsResponseDto = {
  message: string;
  data: OpenLoanRequestsDto;
};

type DisbursementChartResponseDto = {
  message: string;
  data: DisbursementChartEntryDto[];
};

type DashboardOverviewResponseDto = {
  message: string;
  data: DashboardOverviewDto;
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
