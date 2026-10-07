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
  /** The latest voucher anywhere. */
  lastRepaymentRun: {
    period: string;
    date: string;
    upToDate: boolean;
    /** The organization whose voucher it was. */
    organization: string;
  } | null;
  currentPeriod: string;
  /** Where each organization's payroll stands (variations are per organization). */
  organizations: {
    id: string;
    name: string;
    /** The latest month whose variation is locked (a voucher, or no payroll). */
    latestLocked: { ym: string; label: string } | null;
    /** Generated months still waiting for their voucher, oldest first. */
    awaitingVoucher: { ym: string; label: string }[];
    /** The month its next variation is for; null when there is nothing to generate. */
    toGenerate: { ym: string; label: string } | null;
  }[];
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
