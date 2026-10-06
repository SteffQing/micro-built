import { ApiProperty } from '@nestjs/swagger';
import {
  CommodityRequestStatus,
  LoanCategory,
  LoanStatus,
  MicroLoanStatus,
  TenureChangeStatus,
} from '@prisma/client';
import { LoanFiguresDto } from 'src/common/dto/loan.dto';

/** Whether an asset request opens a new asset loan or tops up a running loan. */
export const COMMODITY_REQUEST_KINDS = ['NEW_LOAN', 'TOPUP'] as const;
export type CommodityRequestKind = (typeof COMMODITY_REQUEST_KINDS)[number];

export class LoanCustomerRefDto {
  @ApiProperty({ example: 'MB-E0320S', description: 'Customer (user) id' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: '1234567', nullable: true, type: String, description: 'IPPIS number' })
  externalId: string | null;
}

export class LoanBorrowerDto extends LoanCustomerRefDto {
  @ApiProperty({
    example: 'user@example.com',
    nullable: true,
    type: String,
    description: 'null when the customer signed up with a phone number only',
  })
  email: string | null;

  @ApiProperty({ example: '+2348012345678', nullable: true, type: String })
  phoneNumber: string | null;
}

export class LoanAdminRefDto {
  @ApiProperty({ example: 'AD-1M8KI4' })
  id: string;

  @ApiProperty({ example: 'Jane Admin' })
  name: string;
}

export class TopupTenureChangeDto {
  @ApiProperty({ example: 'cmf1k2...' })
  id: string;

  @ApiProperty({ example: 3, description: 'Months added (negative: removed) with the top-up' })
  monthsDelta: number;

  @ApiProperty({ enum: TenureChangeStatus, example: TenureChangeStatus.PENDING })
  status: TenureChangeStatus;

  @ApiProperty({ example: false, description: 'Also books interest on the running loan for the added months' })
  reprice: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 3000,
    description: "Interest booked for it (a repriced change once applied); null when none. Booked interest can't be taken back.",
  })
  interestAdded: number | null;
}

export class LoanTopupDto {
  @ApiProperty({ example: 'cmf1k2...', description: 'Top-up (microloan) id' })
  id: string;

  @ApiProperty({ example: 50000 })
  amount: number;

  @ApiProperty({ enum: MicroLoanStatus, example: MicroLoanStatus.PENDING })
  status: MicroLoanStatus;

  @ApiProperty({ example: '2026-06-28T12:00:00Z' })
  requestedAt: Date;

  @ApiProperty({ example: null, nullable: true, type: Date })
  disbursedAt: Date | null;

  @ApiProperty({
    type: TopupTenureChangeDto,
    nullable: true,
    description: 'The tenure change requested with the top-up (applied when it is disbursed)',
  })
  tenureChange: TopupTenureChangeDto | null;
}

export class LoanAssetDto {
  @ApiProperty({ example: 'cmf1k2...', description: 'Asset request (commodity loan) id' })
  id: string;

  @ApiProperty({ example: 'Laptop', description: 'Commodity name' })
  name: string;

  @ApiProperty({ enum: CommodityRequestStatus, example: CommodityRequestStatus.APPROVED })
  status: CommodityRequestStatus;

  @ApiProperty({ enum: COMMODITY_REQUEST_KINDS, example: 'NEW_LOAN' })
  kind: CommodityRequestKind;
}

/** A loan with its ledger figures; also the customer's active loan (`GET /admin/customer/:id/active-loan`). */
export class ActiveLoanDto extends LoanFiguresDto {
  @ApiProperty({ example: 'LN-39E02S' })
  id: string;

  @ApiProperty({ enum: LoanCategory, example: LoanCategory.PERSONAL })
  category: LoanCategory;

  @ApiProperty({ enum: LoanStatus, example: LoanStatus.DISBURSED })
  status: LoanStatus;

  @ApiProperty({ example: '2026-06-20T15:45:00Z', nullable: true, type: Date })
  disbursementDate: Date | null;
}

export class CashLoanItemDto extends ActiveLoanDto {
  @ApiProperty({ example: '2026-06-28T12:00:00Z', description: 'When the loan was requested' })
  date: Date;

  @ApiProperty({ type: LoanCustomerRefDto })
  customer: LoanCustomerRefDto;
}

export class CashLoanDto extends ActiveLoanDto {
  @ApiProperty({ example: 3, description: 'Interest rate snapshotted on approval (percent per month)' })
  interestRate: number;

  @ApiProperty({ example: 2.5, description: 'Management fee rate snapshotted on approval (percent)' })
  managementFeeRate: number;

  @ApiProperty({
    example: 2500,
    description:
      'Management fee taken from the cash handed over (never part of owed); before disbursement, what will be taken',
  })
  managementFee: number;

  @ApiProperty({ example: '2026-06-01T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-02T10:00:00Z' })
  updatedAt: Date;

  @ApiProperty({ type: LoanBorrowerDto })
  borrower: LoanBorrowerDto;

  @ApiProperty({
    type: LoanAdminRefDto,
    nullable: true,
    description: 'The admin who raised it for the customer; null when the customer asked',
  })
  requestedBy: LoanAdminRefDto | null;

  @ApiProperty({ type: [LoanAssetDto], description: 'Asset requests on this loan (the asset loan and asset top-ups)' })
  assets: LoanAssetDto[];

  @ApiProperty({ type: [LoanTopupDto], description: 'Top-ups on this loan, newest first' })
  topups: LoanTopupDto[];
}

export class CommodityLoanItemDto {
  @ApiProperty({ example: 'cmf1k2...', description: 'Asset request id' })
  id: string;

  @ApiProperty({ example: '2026-06-28T12:00:00Z', description: 'When the request was made' })
  date: Date;

  @ApiProperty({ type: LoanCustomerRefDto })
  customer: LoanCustomerRefDto;

  @ApiProperty({ example: 'Laptop', description: 'Commodity name' })
  name: string;

  @ApiProperty({ enum: CommodityRequestStatus, example: CommodityRequestStatus.IN_REVIEW })
  status: CommodityRequestStatus;

  @ApiProperty({ example: true, description: 'status === IN_REVIEW' })
  inReview: boolean;

  @ApiProperty({ enum: COMMODITY_REQUEST_KINDS, example: 'NEW_LOAN' })
  kind: CommodityRequestKind;

  @ApiProperty({
    example: 450000,
    nullable: true,
    type: Number,
    description: 'What the customer borrows for it, once approved; null while in review or when rejected',
  })
  amount: number | null;

  @ApiProperty({ example: 'LN-C03S2O' })
  loanId: string;

  @ApiProperty({ enum: LoanStatus, example: LoanStatus.PENDING })
  loanStatus: LoanStatus;
}

export class CommodityLoanDto {
  @ApiProperty({ example: 'cmf1k2...' })
  id: string;

  @ApiProperty({ example: 'Laptop', description: 'Commodity name' })
  name: string;

  @ApiProperty({ enum: CommodityRequestStatus, example: CommodityRequestStatus.IN_REVIEW })
  status: CommodityRequestStatus;

  @ApiProperty({ example: true, description: 'status === IN_REVIEW' })
  inReview: boolean;

  @ApiProperty({ enum: COMMODITY_REQUEST_KINDS, example: 'NEW_LOAN' })
  kind: CommodityRequestKind;

  @ApiProperty({ example: '2026-06-01T12:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: 'HP EliteBook 840 G8, delivered within 7 days', nullable: true, type: String })
  publicDetails: string | null;

  @ApiProperty({
    example: 'Bought from Slot Ikeja at ₦410,000',
    nullable: true,
    type: String,
    description: 'Admins only',
  })
  privateDetails: string | null;

  @ApiProperty({ example: 450000, nullable: true, type: Number, description: 'null while in review or when rejected' })
  amount: number | null;

  @ApiProperty({ example: 'LN-39E02S' })
  loanId: string;

  @ApiProperty({
    type: LoanTopupDto,
    nullable: true,
    description: 'An asset top-up: the top-up that pays for it, once approved',
  })
  topup: LoanTopupDto | null;

  @ApiProperty({ type: LoanBorrowerDto })
  borrower: LoanBorrowerDto;

  @ApiProperty({ type: ActiveLoanDto, description: 'The loan the request belongs to, with its figures' })
  loan: ActiveLoanDto;
}

export class TopupAssetDto {
  @ApiProperty({ example: 'cmf1k2...', description: 'Asset request id' })
  id: string;

  @ApiProperty({ example: 'Laptop' })
  name: string;
}

export class TopupItemDto extends LoanTopupDto {
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Net pay too low for the new monthly deduction',
    description: "Why it was rejected (REJECTED top-ups, on GET /admin/loans/topups/:id); null otherwise or when none was given",
  })
  rejectionNote: string | null;

  @ApiProperty({ example: 'LN-39E02S' })
  loanId: string;

  @ApiProperty({ type: LoanCustomerRefDto })
  customer: LoanCustomerRefDto;

  @ApiProperty({ type: TopupAssetDto, nullable: true, description: 'The asset this top-up pays for, if any' })
  asset: TopupAssetDto | null;
}
