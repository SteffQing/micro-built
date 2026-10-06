import { ApiProperty } from '@nestjs/swagger';
import { LoanCategory, LoanStatus, UserStatus } from '@prisma/client';
import { COMMODITY_REQUEST_KINDS, type CommodityRequestKind } from './loan.entities';

// Responses of /admin/dashboard/*. Money figures follow V2.MD §0.5 and use the names of the
// customer summary (GET /admin/customer/:id/summary). Every name here starts with Dashboard,
// LoanReport or is otherwise unique: the entities and dto barrels re-export this file.

export class DashboardOverviewDto {
  @ApiProperty({ example: 18, description: 'Loans running now (DISBURSED); ignores from/to' })
  activeCount: number;

  @ApiProperty({ example: 7, description: 'Loan requests PENDING plus top-ups PENDING; ignores from/to' })
  pendingCount: number;

  @ApiProperty({
    example: 920000,
    description: 'Principal + interest booked in the range (disbursed loans, top-ups and their interest; penalties excluded)',
  })
  totalLoanAmount: number;

  @ApiProperty({ example: 548000, description: 'Cash handed over in the range: principal booked minus the management fee' })
  totalDisbursed: number;

  @ApiProperty({ example: 12000, description: 'Management fee on the principal booked in the range' })
  managementFee: number;

  @ApiProperty({ example: 360000, description: 'Interest booked in the range, collected or not' })
  interestBooked: number;

  @ApiProperty({ example: 90000, description: 'Interest collected from payments of the payroll months in the range' })
  interestCollected: number;

  @ApiProperty({ example: 4000, description: 'Penalties charged in the range, collected or not' })
  penaltyCharged: number;

  @ApiProperty({ example: 1500, description: 'Penalties collected from payments of the payroll months in the range' })
  penaltyCollected: number;

  @ApiProperty({ example: 372000, description: 'managementFee + interestBooked' })
  grossProfit: number;

  @ApiProperty({ example: 610000, description: 'Still owed on running loans (owed − repaid), always all-time' })
  outstanding: number;
}

export class LoanReportOverviewDto {
  @ApiProperty({ example: 1600000, description: 'Principal + interest booked in the range (penalties excluded)' })
  totalLoanAmount: number;

  @ApiProperty({ example: 970000, description: 'Cash handed over in the range: principal booked minus the management fee' })
  totalDisbursed: number;

  @ApiProperty({ example: 600000, description: 'Still owed on running loans (owed − repaid), always all-time' })
  outstanding: number;

  @ApiProperty({
    example: 750000,
    description: 'Collected (principal, interest and penalties) from payments of the payroll months in the range',
  })
  totalRepaid: number;

  @ApiProperty({ example: 120000, description: 'Interest booked in the range, collected or not' })
  interestBooked: number;

  @ApiProperty({ example: 90000, description: 'Interest collected from payments of the payroll months in the range' })
  interestCollected: number;

  @ApiProperty({ example: 42, description: 'Loans running now (DISBURSED); ignores from/to' })
  activeLoansCount: number;

  @ApiProperty({ example: 18, description: 'Loan requests PENDING plus top-ups PENDING; ignores from/to' })
  pendingLoansCount: number;
}

export class DashboardDisbursementMonthDto {
  @ApiProperty({ example: 'JUNE 2026', description: 'Lagos calendar month' })
  period: string;

  @ApiProperty({
    description: 'Principal disbursed that month (new loans and top-ups) by loan category; categories with none are left out',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { PERSONAL: 250000, ASSET_PURCHASE: 400000 },
  })
  categories: Partial<Record<LoanCategory, number>>;

  @ApiProperty({ example: 650000 })
  total: number;
}

export class DashboardCashLoanRequestDto {
  @ApiProperty({ example: 'LN-A45DQ6', description: 'Loan id' })
  id: string;

  @ApiProperty({ example: 'MB-E0320S' })
  customerId: string;

  @ApiProperty({ example: 'John Doe' })
  customerName: string;

  @ApiProperty({ example: 50000, description: 'Requested principal' })
  amount: number;

  @ApiProperty({ enum: LoanCategory, example: LoanCategory.BUSINESS })
  category: LoanCategory;

  @ApiProperty({ example: '2026-06-01T12:00:00Z' })
  requestedAt: Date;
}

export class DashboardTopupRequestDto {
  @ApiProperty({ example: 'cmf1k2…', description: 'Top-up id' })
  id: string;

  @ApiProperty({ example: 'LN-A45DQ6', description: 'The running loan it tops up' })
  loanId: string;

  @ApiProperty({ example: 'MB-E0320S' })
  customerId: string;

  @ApiProperty({ example: 'John Doe' })
  customerName: string;

  @ApiProperty({ example: 30000 })
  amount: number;

  @ApiProperty({ enum: LoanCategory, example: LoanCategory.PERSONAL, description: "The loan's category" })
  category: LoanCategory;

  @ApiProperty({ example: '2026-06-01T12:00:00Z' })
  requestedAt: Date;
}

export class DashboardCommodityRequestDto {
  @ApiProperty({ example: 'cmf1k2…', description: 'Asset request id' })
  id: string;

  @ApiProperty({ example: 'LN-A45DQ6' })
  loanId: string;

  @ApiProperty({ example: 'MB-E0320S' })
  customerId: string;

  @ApiProperty({ example: 'John Doe' })
  customerName: string;

  @ApiProperty({ example: 'Laptop', description: 'Commodity name' })
  name: string;

  @ApiProperty({ enum: COMMODITY_REQUEST_KINDS, example: 'NEW_LOAN', description: 'Opens an asset loan or tops up a running one' })
  kind: CommodityRequestKind;

  @ApiProperty({ enum: [LoanCategory.ASSET_PURCHASE], example: LoanCategory.ASSET_PURCHASE })
  category: LoanCategory;

  @ApiProperty({ example: '2026-06-01T12:00:00Z' })
  requestedAt: Date;
}

export class DashboardOpenLoanRequestsDto {
  @ApiProperty({ type: [DashboardCashLoanRequestDto], description: '5 newest PENDING cash loan requests' })
  cashLoans: DashboardCashLoanRequestDto[];

  @ApiProperty({ type: [DashboardTopupRequestDto], description: '5 newest PENDING top-ups' })
  topups: DashboardTopupRequestDto[];

  @ApiProperty({ type: [DashboardCommodityRequestDto], description: '5 newest asset requests IN_REVIEW' })
  commodityLoans: DashboardCommodityRequestDto[];
}

export class LoanReportStatusDistributionDto {
  @ApiProperty({
    description: 'Loans per status; every status is present (0 when none)',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { PENDING: 4, REJECTED: 2, APPROVED: 1, DISBURSED: 80, REPAID: 35 },
  })
  statusCounts: Record<LoanStatus, number>;
}

export class DashboardRepaymentRunDto {
  @ApiProperty({ example: 'JUNE 2026', description: 'Payroll month of the latest payroll upload' })
  period: string;

  @ApiProperty({ example: '2026-06-28T09:00:00Z', description: 'When it was uploaded' })
  date: Date;

  @ApiProperty({ example: true, description: 'No generated month is waiting on its payroll file' })
  upToDate: boolean;
}

export class DashboardRatesDto {
  @ApiProperty({ example: 6, nullable: true, type: Number, description: 'Percent; null until set' })
  interestRate: number | null;

  @ApiProperty({ example: 2.5, nullable: true, type: Number, description: 'Percent; null until set' })
  managementFeeRate: number | null;

  @ApiProperty({ example: 10, nullable: true, type: Number, description: 'Percent; null until set' })
  penaltyRate: number | null;

  @ApiProperty({ example: 33.33, nullable: true, type: Number, description: 'Percent; null = no cap' })
  maxDeductionRate: number | null;
}

export class DashboardAttentionDto {
  @ApiProperty({ example: 2, description: 'Payroll payments UNMATCHED or REVIEWING (manual resolution)' })
  manualResolutions: number;

  @ApiProperty({ example: 1, description: 'Liquidations AWAITING a decision' })
  pendingLiquidations: number;

  @ApiProperty({ example: 4, description: 'Customers FLAGGED' })
  flaggedCustomers: number;

  @ApiProperty({ example: 1, description: 'Tenure changes PENDING' })
  pendingTenureChanges: number;
}

export class DashboardRecentLoanDto {
  @ApiProperty({ example: 'LN-A45DQ6' })
  id: string;

  @ApiProperty({ example: 'MB-E0320S' })
  customerId: string;

  @ApiProperty({ example: 'John Doe' })
  customerName: string;

  @ApiProperty({ example: 200000, description: 'Principal, disbursed top-ups included' })
  amount: number;

  @ApiProperty({ enum: LoanCategory, example: LoanCategory.PERSONAL })
  category: LoanCategory;

  @ApiProperty({ enum: LoanStatus, example: LoanStatus.DISBURSED })
  status: LoanStatus;

  @ApiProperty({ example: '2026-06-20T10:00:00Z' })
  disbursedAt: Date;
}

export class DashboardRecentCustomerDto {
  @ApiProperty({ example: 'MB-E0320S' })
  id: string;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ example: '2026-06-25T09:00:00Z' })
  createdAt: Date;
}

export class DashboardOperationsDto {
  @ApiProperty({ type: DashboardRepaymentRunDto, nullable: true, description: 'Latest payroll upload; null before the first' })
  lastRepaymentRun: DashboardRepaymentRunDto | null;

  @ApiProperty({ example: 'JULY 2026', description: 'The current Lagos payroll month' })
  currentPeriod: string;

  @ApiProperty({
    example: 'JUNE 2026',
    nullable: true,
    type: String,
    description: 'The earliest generated month whose deductions wait on the payroll file (AWAITING); null when none',
  })
  awaitingPayrollPeriod: string | null;

  @ApiProperty({ example: 'JULY 2026', description: 'The month the next variation is for (holds the OPEN deductions)' })
  nextVariationPeriod: string;

  @ApiProperty({ type: DashboardRatesDto })
  rates: DashboardRatesDto;

  @ApiProperty({ type: DashboardAttentionDto, description: 'Counts of items waiting on an admin' })
  attention: DashboardAttentionDto;

  @ApiProperty({ type: [DashboardRecentLoanDto], description: '5 most recently disbursed loans' })
  recentLoans: DashboardRecentLoanDto[];

  @ApiProperty({ type: [DashboardRecentCustomerDto], description: '5 newest customers' })
  recentCustomers: DashboardRecentCustomerDto[];
}
