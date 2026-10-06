import { ApiProperty } from '@nestjs/swagger';
import {
  CommodityRequestStatus,
  LoanCategory,
  LoanStatus,
  MicroLoanStatus,
  TenureChangeStatus,
} from '@prisma/client';
import { LoanFiguresDto } from 'src/common/dto/loan.dto';

// Customer-facing loan responses. Class names are unique across src/user/common/entities (an
// `export *` barrel) and Swagger's schema list, so they all start with "User".

export const LOAN_REQUEST_KINDS = ['LOAN', 'TOPUP', 'COMMODITY'] as const;
export type LoanRequestKind = (typeof LOAN_REQUEST_KINDS)[number];

const REQUEST_STATUSES = [
  ...new Set<string>([
    ...Object.values(LoanStatus),
    ...Object.values(MicroLoanStatus),
    ...Object.values(CommodityRequestStatus),
  ]),
];

export class UserLoanRequestResultDto {
  @ApiProperty({
    enum: ['LOAN', 'TOPUP'],
    example: 'LOAN',
    description: 'LOAN: a new loan was requested. TOPUP: a top-up (or asset request) on the running loan.',
  })
  kind: 'LOAN' | 'TOPUP';

  @ApiProperty({
    example: 'LN-Q30E22',
    description: 'The new loan’s id, the top-up’s id, or the asset request’s id',
  })
  id: string;

  @ApiProperty({ example: 'LN-Q30E22', description: 'The loan the request belongs to' })
  loanId: string;
}

export class UserTopupTenureChangeDto {
  @ApiProperty({ example: 3, description: 'Months added (negative: removed) with the top-up' })
  monthsDelta: number;

  @ApiProperty({ enum: TenureChangeStatus, example: TenureChangeStatus.PENDING })
  status: TenureChangeStatus;
}

export class UserLoanTopupDto {
  @ApiProperty({ example: 'cm1x2y3z40000abcd' })
  id: string;

  @ApiProperty({ example: 50000 })
  amount: number;

  @ApiProperty({ enum: MicroLoanStatus, example: MicroLoanStatus.PENDING })
  status: MicroLoanStatus;

  @ApiProperty({ example: '2026-06-02T10:00:00.000Z' })
  requestedAt: Date;

  @ApiProperty({ nullable: true, type: Date, example: null })
  disbursedAt: Date | null;

  @ApiProperty({ type: UserTopupTenureChangeDto, nullable: true })
  tenureChange: UserTopupTenureChangeDto | null;
}

export class UserCommodityRequestDto {
  @ApiProperty({ example: 'cm1x2y3z40000abcd' })
  id: string;

  @ApiProperty({ example: 'LN-Q30E22' })
  loanId: string;

  @ApiProperty({ example: 'Laptop', description: 'Commodity name' })
  name: string;

  @ApiProperty({ enum: CommodityRequestStatus, example: CommodityRequestStatus.IN_REVIEW })
  status: CommodityRequestStatus;

  @ApiProperty({
    enum: ['NEW_LOAN', 'TOPUP'],
    example: 'NEW_LOAN',
    description: 'NEW_LOAN: the request opened an asset loan. TOPUP: an asset added to a running loan.',
  })
  kind: 'NEW_LOAN' | 'TOPUP';

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 350000,
    description: 'What the asset costs, once an admin has approved it; null before',
  })
  amount: number | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Your laptop will be delivered to 12 Port Avenue, Lagos',
    description: 'Details from the admin for the customer',
  })
  details: string | null;

  @ApiProperty({ example: '2026-06-02T10:00:00.000Z', description: 'When it was requested' })
  date: Date;

  @ApiProperty({
    enum: ['IN_REVIEW', 'APPROVED', 'DELIVERED', 'REJECTED'],
    example: 'APPROVED',
    description:
      'Where it is: IN_REVIEW; APPROVED (waiting to be paid out); DELIVERED (paid out: the top-up or the loan it ' +
      'opened was disbursed); REJECTED (the request, or its top-up or loan after approval).',
  })
  stage: 'IN_REVIEW' | 'APPROVED' | 'DELIVERED' | 'REJECTED';

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The top-up (micro-loan) that pays for it, once approved; GET /user/loan/micro/:id',
  })
  microLoanId: string | null;
}

export class UserLoanItemDto extends LoanFiguresDto {
  @ApiProperty({ example: 'LN-Q30E22' })
  id: string;

  @ApiProperty({ enum: LoanCategory, example: LoanCategory.PERSONAL })
  category: LoanCategory;

  @ApiProperty({ enum: LoanStatus, example: LoanStatus.DISBURSED })
  status: LoanStatus;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Laptop',
    description: 'Asset loans: the commodity the loan was opened for',
  })
  assetName: string | null;

  @ApiProperty({ nullable: true, type: Date, example: '2026-03-02T10:00:00.000Z' })
  disbursementDate: Date | null;

  @ApiProperty({ example: '2026-02-20T10:00:00.000Z', description: 'When it was requested' })
  createdAt: Date;
}

export class UserLoanDetailDto extends UserLoanItemDto {
  @ApiProperty({ example: '2026-02-21T10:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: [UserLoanTopupDto], description: 'Newest first' })
  topups: UserLoanTopupDto[];

  @ApiProperty({ type: [UserCommodityRequestDto], description: 'Asset requests on this loan, newest first' })
  commodities: UserCommodityRequestDto[];
}

export class UserMicroLoanDto {
  @ApiProperty({ example: 'cm1x2y3z40000abcd' })
  id: string;

  @ApiProperty({ example: 'LN-Q30E22', description: 'The loan it belongs to' })
  loanId: string;

  @ApiProperty({ enum: ['NEW_LOAN', 'TOPUP'], description: 'NEW_LOAN: the loan as first paid out. TOPUP: added later' })
  purpose: 'NEW_LOAN' | 'TOPUP';

  @ApiProperty({ example: 50000 })
  amount: number;

  @ApiProperty({ enum: MicroLoanStatus, example: MicroLoanStatus.DISBURSED })
  status: MicroLoanStatus;

  @ApiProperty({ example: '2026-06-02T10:00:00.000Z' })
  requestedAt: Date;

  @ApiProperty({ nullable: true, type: Date })
  disbursedAt: Date | null;

  @ApiProperty({ nullable: true, type: String, example: 'Hisense TV 40"', description: 'The asset it paid for' })
  assetName: string | null;

  @ApiProperty({ enum: LoanCategory, description: "The loan's category" })
  loanCategory: LoanCategory;

  @ApiProperty({ type: UserTopupTenureChangeDto, nullable: true })
  tenureChange: UserTopupTenureChangeDto | null;
}

export class UserLoanRequestItemDto {
  @ApiProperty({ example: 'LN-Q30E22', description: 'The loan’s, top-up’s or asset request’s id' })
  id: string;

  @ApiProperty({ enum: LOAN_REQUEST_KINDS, example: 'LOAN' })
  kind: LoanRequestKind;

  @ApiProperty({ example: 'LN-Q30E22' })
  loanId: string;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 100000,
    description: 'Amount requested; null for an asset request not yet priced',
  })
  amount: number | null;

  @ApiProperty({ enum: LoanCategory, example: LoanCategory.PERSONAL, description: 'The loan’s category' })
  category: LoanCategory;

  @ApiProperty({
    enum: REQUEST_STATUSES,
    example: LoanStatus.PENDING,
    description: 'LOAN: a loan status. TOPUP: PENDING, APPROVED, REJECTED or DISBURSED. COMMODITY: IN_REVIEW, APPROVED or REJECTED.',
  })
  status: string;

  @ApiProperty({ nullable: true, type: String, example: null, description: 'COMMODITY: the commodity name' })
  name: string | null;

  @ApiProperty({ example: '2026-06-02T10:00:00.000Z', description: 'When it was requested' })
  date: Date;
}

export class UserPendingLoanDto {
  @ApiProperty({ example: 'LN-W03D0Q' })
  id: string;

  @ApiProperty({ example: 140000, description: '0 for an asset request not yet priced' })
  amount: number;

  @ApiProperty({ enum: LoanCategory, example: LoanCategory.PERSONAL })
  category: LoanCategory;

  @ApiProperty({ enum: [LoanStatus.PENDING, LoanStatus.APPROVED], example: LoanStatus.PENDING })
  status: LoanStatus;

  @ApiProperty({ example: '2026-06-02T10:00:00.000Z' })
  date: Date;
}

export class UserPendingTopupDto extends UserLoanTopupDto {
  @ApiProperty({ example: 'LN-Q30E22' })
  loanId: string;
}

export class UserLoansOverviewDto {
  @ApiProperty({ type: [UserPendingLoanDto], description: 'Loan requests not yet disbursed (PENDING or APPROVED)' })
  pendingLoans: UserPendingLoanDto[];

  @ApiProperty({ type: [UserPendingTopupDto], description: 'Top-ups not yet disbursed (PENDING or APPROVED)' })
  pendingTopups: UserPendingTopupDto[];

  @ApiProperty({ type: [UserCommodityRequestDto], description: 'Asset requests in review' })
  commoditiesInReview: UserCommodityRequestDto[];

  @ApiProperty({ example: 0 })
  rejectedCount: number;

  @ApiProperty({ example: 0 })
  approvedCount: number;

  @ApiProperty({ example: 1 })
  disbursedCount: number;

  @ApiProperty({ example: 2 })
  repaidCount: number;
}
