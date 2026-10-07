import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DeductionStatus,
  Gender,
  LoanCategory,
  MaritalStatus,
  MicroLoanStatus,
  PaymentInflowSource,
  PaymentInflowState,
  Relationship,
  TenureChangeReason,
  TenureChangeStatus,
  UserStatus,
} from '@prisma/client';
import { COMMODITY_REQUEST_KINDS, ActiveLoanDto, TopupTenureChangeDto, type CommodityRequestKind } from './loan.entities';

// The customer page (/admin/customer/:id/*).

export class CustomerAdminRefDto {
  @ApiProperty({ example: 'AD-1M8KI4' })
  id: string;

  @ApiProperty({ example: 'Jane Admin' })
  name: string;
}

export class CustomerAssetRefDto {
  @ApiProperty({ example: 'cmf1k2...', description: 'Asset request (commodity loan) id' })
  id: string;

  @ApiProperty({ example: 'Laptop', description: 'Commodity name' })
  name: string;
}

export class CustomerInfoDto {
  @ApiProperty({ example: 'MB-E0320S' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({
    example: 'user@example.com',
    nullable: true,
    type: String,
    description: 'null when the customer signed up with a phone number only',
  })
  email: string | null;

  @ApiProperty({ example: '+2348012345678', nullable: true, type: String })
  phoneNumber: string | null;

  @ApiProperty({ example: null, nullable: true, type: String, description: 'Avatar URL' })
  image: string | null;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ example: null, nullable: true, type: String, description: 'Why the account is flagged' })
  flagReason: string | null;

  @ApiProperty({ example: 'PF12033', nullable: true, type: String, description: 'IPPIS number' })
  externalId: string | null;

  @ApiProperty({ example: 87.5, description: 'Collected ÷ expected on closed payroll months, percent (100 if none)' })
  repaymentRate: number;

  @ApiProperty({ type: CustomerAdminRefDto, nullable: true, description: 'null for self sign-ups' })
  accountOfficer: CustomerAdminRefDto | null;

  @ApiProperty({ example: '2026-01-15T09:00:00Z' })
  createdAt: Date;
}

/** A loan of the customer with its ledger figures. */
export class CustomerLoanItemDto extends ActiveLoanDto {
  @ApiProperty({ example: '2026-06-01T10:00:00Z', description: 'When the loan was requested' })
  createdAt: Date;

  @ApiProperty({ type: CustomerAssetRefDto, nullable: true, description: 'The asset an asset loan was opened for' })
  asset: CustomerAssetRefDto | null;
}

export const CUSTOMER_APPLICATION_TYPES = ['LOAN', 'TOPUP', 'COMMODITY_REQUEST'] as const;
export type CustomerApplicationType = (typeof CUSTOMER_APPLICATION_TYPES)[number];

export class CustomerLoanApplicationDto {
  @ApiProperty({
    enum: CUSTOMER_APPLICATION_TYPES,
    example: 'LOAN',
    description:
      'LOAN: a new loan (an asset loan names its asset); TOPUP: a top-up on the running loan; COMMODITY_REQUEST: an asset top-up still in review',
  })
  recordType: CustomerApplicationType;

  @ApiProperty({
    example: 'LN-39E02S',
    description: 'The id to open: the loan (LOAN), the top-up (TOPUP) or the asset request (COMMODITY_REQUEST)',
  })
  detailsId: string;

  @ApiProperty({ example: 'LN-39E02S' })
  loanId: string;

  @ApiProperty({ enum: COMMODITY_REQUEST_KINDS, example: 'NEW_LOAN' })
  kind: CommodityRequestKind;

  @ApiProperty({ enum: LoanCategory, example: LoanCategory.PERSONAL })
  category: LoanCategory;

  @ApiProperty({ enum: ['PENDING', 'APPROVED'], example: 'PENDING' })
  status: 'PENDING' | 'APPROVED';

  @ApiProperty({ example: 100000, nullable: true, type: Number, description: 'null until an asset is priced' })
  amount: number | null;

  @ApiProperty({ example: 6, nullable: true, type: Number, description: 'Months; null on top-ups and unpriced assets' })
  tenure: number | null;

  @ApiProperty({ example: '2026-06-28T12:00:00Z' })
  date: Date;

  @ApiProperty({ type: CustomerAssetRefDto, nullable: true })
  asset: CustomerAssetRefDto | null;
}

export class CustomerLoansDto {
  @ApiProperty({ type: [CustomerLoanItemDto], description: 'Running (DISBURSED) loans: at most one' })
  activeLoans: CustomerLoanItemDto[];

  @ApiProperty({ type: [CustomerLoanApplicationDto], description: 'Everything waiting for a decision or disbursement, newest first' })
  applications: CustomerLoanApplicationDto[];

  @ApiProperty({ type: [CustomerLoanApplicationDto], description: 'applications with status PENDING' })
  pendingLoans: CustomerLoanApplicationDto[];

  @ApiProperty({ type: [CustomerLoanApplicationDto], description: 'applications with status APPROVED (awaiting disbursement)' })
  approvedLoans: CustomerLoanApplicationDto[];
}

/** Requests still waiting on someone: undisbursed loan requests and top-ups, asset top-ups in review. */
export class CustomerOpenRequestsDto {
  @ApiProperty({ example: 1, description: 'Loan requests PENDING or APPROVED (not yet disbursed)' })
  loans: number;

  @ApiProperty({ example: 0, description: 'Top-ups PENDING or APPROVED (not yet disbursed)' })
  topups: number;

  @ApiProperty({ example: 0, description: 'Asset top-up requests IN_REVIEW' })
  assets: number;

  @ApiProperty({ example: 1 })
  total: number;
}

/** Over the customer's disbursed and repaid loans, from the ledger. */
export class CustomerLoanSummaryDto {
  @ApiProperty({ example: 150000, description: 'Principal booked: loans plus disbursed top-ups' })
  totalBorrowed: number;

  @ApiProperty({ example: 180000, description: 'Principal + interest booked (penalties excluded)' })
  totalLoanAmount: number;

  @ApiProperty({ example: 145500, description: 'Cash handed over: principal minus the management fee' })
  totalDisbursed: number;

  @ApiProperty({ example: 4500 })
  managementFee: number;

  @ApiProperty({ example: 30000 })
  interestBooked: number;

  @ApiProperty({ example: 12000 })
  interestCollected: number;

  @ApiProperty({ example: 2000 })
  penaltyCharged: number;

  @ApiProperty({ example: 500 })
  penaltyCollected: number;

  @ApiProperty({ example: 60000, description: 'Everything repaid (principal, interest and penalties)' })
  totalRepaid: number;

  @ApiProperty({ example: 122000, description: 'Still owed on the running loan, penalties included' })
  outstanding: number;

  @ApiProperty({
    example: 41308.33,
    nullable: true,
    type: Number,
    description: "The running loan's OPEN deduction: what payroll is asked for next",
  })
  monthlyDeduction: number | null;

  @ApiProperty({ example: 3, nullable: true, type: Number, description: 'Months left on the running loan' })
  monthsLeft: number | null;

  @ApiProperty({ example: 'NOVEMBER 2026', nullable: true, type: String, description: 'Payroll month of that OPEN deduction' })
  nextDeductionPeriod: string | null;

  @ApiProperty({ type: () => CustomerOpenRequestsDto })
  openRequests: CustomerOpenRequestsDto;

  @ApiProperty({ example: 87.5, description: 'Repayment rate, percent' })
  repaymentRate: number;

  @ApiProperty({ example: '2026-06-28T12:00:00Z', nullable: true, type: Date, description: 'When the latest repayment was applied' })
  lastRepaymentDate: Date | null;

  @ApiProperty({ example: 'JUNE 2026', nullable: true, type: String, description: 'Payroll month of the latest repayment' })
  lastRepaymentPeriod: string | null;
}

export class CustomerTopupHistoryItemDto {
  @ApiProperty({ example: 'cmf1k2...', description: 'The top-up id, or the asset request id while it is in review' })
  id: string;

  @ApiProperty({ enum: ['TOPUP', 'ASSET_REQUEST'], example: 'TOPUP' })
  recordType: 'TOPUP' | 'ASSET_REQUEST';

  @ApiProperty({ example: 'LN-39E02S' })
  loanId: string;

  @ApiProperty({ example: 50000, nullable: true, type: Number, description: 'null while an asset request is in review' })
  amount: number | null;

  @ApiProperty({ enum: MicroLoanStatus, example: MicroLoanStatus.PENDING, description: 'An asset request in review is PENDING' })
  status: MicroLoanStatus;

  @ApiProperty({ example: '2026-06-28T12:00:00Z' })
  requestedAt: Date;

  @ApiProperty({ example: null, nullable: true, type: Date })
  disbursedAt: Date | null;

  @ApiProperty({ type: CustomerAssetRefDto, nullable: true, description: 'The asset it pays for, if any' })
  asset: CustomerAssetRefDto | null;

  @ApiProperty({ type: TopupTenureChangeDto, nullable: true, description: 'The tenure change requested with it' })
  tenureChange: TopupTenureChangeDto | null;
}

export class CustomerTenureChangeDto {
  @ApiProperty({ example: 'cmf1k2...' })
  id: string;

  @ApiProperty({ example: 'LN-39E02S' })
  loanId: string;

  @ApiProperty({ example: 6, description: 'The tenure before the change (set again when it is approved)' })
  previousTenure: number;

  @ApiProperty({ example: 3, description: 'Months added; negative = removed' })
  monthsDelta: number;

  @ApiProperty({ example: 9, description: "The loan's tenure now" })
  loanTenure: number;

  @ApiProperty({ enum: TenureChangeReason, example: TenureChangeReason.TOPUP })
  reason: TenureChangeReason;

  @ApiProperty({ enum: TenureChangeStatus, example: TenureChangeStatus.PENDING })
  status: TenureChangeStatus;

  @ApiProperty({ example: null, nullable: true, type: String, description: 'The top-up it was requested with' })
  topupId: string | null;

  @ApiProperty({ type: CustomerAdminRefDto, nullable: true, description: 'null when the system proposed it' })
  requestedBy: CustomerAdminRefDto | null;

  @ApiProperty({ example: '2026-06-28T12:00:00Z' })
  createdAt: Date;
}

export class CustomerStatementSplitDto {
  @ApiProperty({ example: 8333.33 })
  principal: number;

  @ApiProperty({ example: 1666.67 })
  interest: number;

  @ApiProperty({ example: 0 })
  penalty: number;
}

export class CustomerStatementLineDto {
  @ApiProperty({ example: '2026-06-20T15:45:00Z' })
  date: Date;

  @ApiProperty({ example: 'LN-39E02S' })
  loanId: string;

  @ApiProperty({ example: 'cmf1k2...', description: 'The microloan or repayment id' })
  reference: string;

  @ApiProperty({ enum: ['DISBURSEMENT', 'INTEREST', 'PENALTY', 'REPAYMENT'], example: 'REPAYMENT' })
  type: 'DISBURSEMENT' | 'INTEREST' | 'PENALTY' | 'REPAYMENT';

  @ApiProperty({ example: 'Payroll deduction, JUNE 2026' })
  description: string;

  @ApiProperty({ example: 0 })
  debit: number;

  @ApiProperty({ example: 10000 })
  credit: number;

  @ApiProperty({ example: 110000, description: 'Running balance after this line' })
  balance: number;

  @ApiProperty({ example: 3000, required: false, description: 'On a disbursement: kept from the cash handed over' })
  managementFee?: number;

  @ApiProperty({ type: CustomerStatementSplitDto, required: false, description: 'On a repayment: how it was split' })
  split?: CustomerStatementSplitDto;
}

export class CustomerLoanStatementDto {
  @ApiProperty({ example: 'JANUARY 2026', description: 'First payroll month shown' })
  from: string;

  @ApiProperty({ example: 'JUNE 2026', description: 'Last payroll month shown' })
  to: string;

  @ApiProperty({ example: 0, description: 'Balance before `from`' })
  opening: number;

  @ApiProperty({ example: 120000, description: 'Σ debits in the range (all pages)' })
  debits: number;

  @ApiProperty({ example: 30000, description: 'Σ credits in the range (all pages)' })
  credits: number;

  @ApiProperty({ example: 90000 })
  closing: number;

  @ApiProperty({ type: [CustomerStatementLineDto], description: 'This page of lines, oldest first' })
  lines: CustomerStatementLineDto[];
}

export class CustomerRepaymentDto {
  @ApiProperty({ example: 'cmf1k2...', description: 'Payment (inflow) id' })
  id: string;

  @ApiProperty({ enum: PaymentInflowSource, example: PaymentInflowSource.PAYROLL })
  source: PaymentInflowSource;

  @ApiProperty({ enum: PaymentInflowState, example: PaymentInflowState.SETTLED })
  state: PaymentInflowState;

  @ApiProperty({ example: 'JUNE 2026', description: 'Payroll month' })
  period: string;

  @ApiProperty({ example: 25000, description: 'What came in' })
  amount: number;

  @ApiProperty({ example: 22500, description: 'What was applied to the loan (0 if nothing yet)' })
  applied: number;

  @ApiProperty({ example: 'LN-39E02S', nullable: true, type: String })
  loanId: string | null;

  @ApiProperty({ type: CustomerStatementSplitDto, nullable: true, description: 'How the applied amount was split' })
  split: CustomerStatementSplitDto | null;

  @ApiProperty({ example: 22500, nullable: true, type: Number, description: 'What payroll was asked for that month' })
  expected: number | null;

  @ApiProperty({ enum: DeductionStatus, nullable: true, example: DeductionStatus.FULFILLED })
  deductionStatus: DeductionStatus | null;

  @ApiProperty({ example: '2026-06-28T12:00:00Z' })
  createdAt: Date;
}

export class CustomerPayrollDto {
  @ApiProperty({ example: 'PF12033', description: 'IPPIS number' })
  externalId: string;

  @ApiProperty({ example: 120000 })
  netPay: number;

  @ApiProperty({ example: 180000 })
  employeeGross: number;

  @ApiProperty({ example: 'Level 12', nullable: true, type: String })
  grade: string | null;

  @ApiProperty({ example: 3, nullable: true, type: Number })
  step: number | null;

  @ApiProperty({ example: 'Lagos Command' })
  command: string;

  @ApiProperty({ example: 'NPF', description: 'The organization’s name' })
  organization: string;

  @ApiProperty({ description: 'The organization (GET /admin/organizations)' })
  organizationId: string;
}

export class CustomerIdentityDto {
  @ApiProperty({ example: '1990-01-01T00:00:00.000Z' })
  dateOfBirth: Date;

  @ApiProperty({ enum: Gender })
  gender: Gender;

  @ApiProperty({ enum: MaritalStatus })
  maritalStatus: MaritalStatus;

  @ApiProperty({ example: '123 Main Street, Lagos' })
  residencyAddress: string;

  @ApiProperty({ example: 'Lagos' })
  stateResidency: string;

  @ApiProperty({ example: 'Adjacent Crescent Moon Printing House' })
  landmarkOrBusStop: string;

  @ApiProperty({ example: 'Jane Doe' })
  nextOfKinName: string;

  @ApiProperty({ example: '08012345678' })
  nextOfKinContact: string;

  @ApiProperty({ example: 'Iperu-Remo, Ogun state' })
  nextOfKinAddress: string;

  @ApiProperty({ enum: Relationship })
  nextOfKinRelationship: Relationship;
}

export class CustomerPaymentMethodDto {
  @ApiProperty({ example: 'Access Bank' })
  bankName: string;

  @ApiProperty({ example: '0123456789' })
  accountNumber: string;

  @ApiProperty({ example: 'John Doe' })
  accountName: string;
}

export class CustomerPaymentMethodWithBvnDto extends CustomerPaymentMethodDto {
  @ApiPropertyOptional({ example: '01234567890', description: 'Super admins only; left out for everyone else' })
  bvn?: string;
}

export class CustomerPPIDto {
  @ApiProperty({ type: CustomerPayrollDto, nullable: true })
  payroll: CustomerPayrollDto | null;

  @ApiProperty({ type: CustomerIdentityDto, nullable: true })
  identity: CustomerIdentityDto | null;

  @ApiProperty({ type: CustomerPaymentMethodWithBvnDto, nullable: true })
  paymentMethod: CustomerPaymentMethodWithBvnDto | null;
}

export class CustomerTopupRequestResultDto {
  @ApiProperty({ enum: ['CASH', 'ASSET'], example: 'CASH' })
  kind: 'CASH' | 'ASSET';

  @ApiProperty({ example: 'LN-39E02S', description: 'The running loan topped up' })
  loanId: string;

  @ApiProperty({
    example: 'cmf1k2...',
    nullable: true,
    type: String,
    description: 'CASH: the top-up, PENDING until approved (PATCH /admin/loans/topups/:id/approve)',
  })
  topupId: string | null;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
    description: 'ASSET: the asset request, IN_REVIEW until priced (PATCH /admin/loans/commodity/:id/approve)',
  })
  commodityLoanId: string | null;
}
