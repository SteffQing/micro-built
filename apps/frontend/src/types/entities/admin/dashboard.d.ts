type DashboardOverviewDto = {
  activeCount: number;
  pendingCount: number;
  totalLoanAmount: number;
  totalDisbursed: number;
  managementFee: number;
  interestBooked: number;
  interestCollected: number;
  penaltyCharged: number;
  penaltyCollected: number;
  grossProfit: number;
  outstanding: number;
};

type DisbursementChartEntryDto = Array<{
  period: string;
  categories: Partial<Record<LoanCategory, number>>;
  total: number;
}>;

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

type TopupRequestDto = {
  id: string;
  loanId: string;
  customerId: string;
  customerName: string;
  amount: number;
  status: LoanStatus;
  requestedAt: Date;
};

type OpenLoanRequestsDto = {
  cashLoans: CashLoanRequestDto[];
  topups: TopupRequestDto[];
  commodityLoans: CommodityLoanRequestDto[];
};

type LoanReportOverviewDto = {
  totalLoanAmount: number;
  totalDisbursed: number;
  outstanding: number;
  totalRepaid: number;
  interestBooked: number;
  interestCollected: number;
  activeLoansCount: number;
  pendingLoansCount: number;
};

type LoanReportStatusDistributionDto = {
  statusCounts: Record<LoanStatus, number>;
};

type DashboardOperationsDto = {
  lastRepaymentRun: {
    period: string;
    date: string;
    upToDate: boolean;
  } | null;
  currentPeriod: string;
  rates: {
    interestRate: number | null;
    managementFeeRate: number | null;
    penaltyRate: number | null;
    maxDeductionRate: number | null;
  };
  attention: {
    manualResolutions: number;
    pendingLiquidations: number;
    flaggedCustomers: number;
    pendingTenureChanges: number;
  };
  recentLoans: {
    id: string;
    customerId: string;
    customerName: string;
    amount: number;
    category: LoanCategory;
    status: LoanStatus;
    disbursedAt: string | null;
  }[];
  recentCustomers: {
    id: string;
    name: string;
    status: UserStatus;
    createdAt: string;
  }[];
};
