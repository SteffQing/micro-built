import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { AdminRole, DeductionStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  CashLoanItemDto,
  CommodityLoanItemDto,
  LoanCustomerRefDto,
  TopupItemDto,
} from 'src/admin/common/entities/loan.entities';
import { YM_PATTERN } from 'src/common/dto/period.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** What a marketer can ask an admin to act on: a loan waiting for approval or disbursement, an asset request, a top-up. */
export const ESCALATION_KINDS = ['LOAN', 'ASSET_REQUEST', 'TOPUP'] as const;
export type EscalationKind = (typeof ESCALATION_KINDS)[number];

/** Who can move it on: any admin while it waits for a decision, only a super admin once it waits for disbursement. */
export const ESCALATION_STAGES = ['DECISION', 'DISBURSEMENT'] as const;
export type EscalationStage = (typeof ESCALATION_STAGES)[number];

export class EscalationStateDto {
  @ApiProperty({
    enum: ESCALATION_STAGES,
    nullable: true,
    example: 'DECISION',
    description: 'What it waits for; null when there is nothing left to escalate (decided, disbursed)',
  })
  stage: EscalationStage | null;

  @ApiProperty({ nullable: true, type: Date, example: null, description: 'When you last escalated it (this stage)' })
  lastEscalatedAt: Date | null;
}

export class MarketerCashLoanItemDto extends IntersectionType(CashLoanItemDto, EscalationStateDto) {}
export class MarketerAssetRequestItemDto extends IntersectionType(CommodityLoanItemDto, EscalationStateDto) {}
export class MarketerTopupItemDto extends IntersectionType(TopupItemDto, EscalationStateDto) {}

export class MarketerAdminDto {
  @ApiProperty({ example: 'AD-1M8KI' })
  id: string;

  @ApiProperty({ example: 'Jane Admin' })
  name: string;

  @ApiProperty({ enum: [AdminRole.ADMIN, AdminRole.SUPER_ADMIN], example: AdminRole.ADMIN })
  role: AdminRole;
}

export class EscalateDto {
  @ApiProperty({ enum: ESCALATION_KINDS, example: 'LOAN' })
  @IsIn(ESCALATION_KINDS)
  kind: EscalationKind;

  @ApiProperty({ example: 'LN-4KD8QZ', description: 'The loan, asset request or top-up id' })
  @IsString()
  @MaxLength(64)
  id: string;

  @ApiPropertyOptional({
    example: 'AD-1M8KI',
    description: 'One admin to ask; leave out to ask everyone who can act on it now',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  adminId?: string;

  @ApiPropertyOptional({ example: 'The customer needs it before school resumes', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trim)
  note?: string;
}

export class EscalationResultDto {
  @ApiProperty({ example: ['Jane Admin'], description: 'Who was asked' })
  sentTo: string[];

  @ApiProperty({ example: [], description: 'Who was left out: already asked about this in the last 24 hours' })
  skipped: string[];

  @ApiProperty({ example: '2026-10-07T10:00:00Z' })
  escalatedAt: Date;
}

export const WAITING_KINDS = ['CUSTOMER', 'LOAN', 'ASSET_REQUEST', 'TOPUP', 'ORGANIZATION'] as const;
export type WaitingKind = (typeof WAITING_KINDS)[number];

export class WaitingItemDto {
  @ApiProperty({ enum: WAITING_KINDS, example: 'LOAN' })
  kind: WaitingKind;

  @ApiProperty({ example: 'LN-4KD8QZ', description: 'The customer, loan, asset request, top-up or organization id' })
  id: string;

  @ApiProperty({ example: 'Cash loan of ₦250,000' })
  title: string;

  @ApiProperty({ example: 'Waiting for approval' })
  detail: string;

  @ApiProperty({ type: LoanCustomerRefDto, nullable: true, description: 'null for an organization' })
  customer: LoanCustomerRefDto | null;

  @ApiProperty({ example: '2026-10-01T09:00:00Z', description: 'Since when it has been waiting' })
  since: Date;

  @ApiProperty({ enum: ESCALATION_KINDS, nullable: true, example: 'LOAN', description: 'What to escalate it as; null when it cannot be' })
  escalation: EscalationKind | null;

  @ApiProperty({ enum: ESCALATION_STAGES, nullable: true, example: 'DECISION' })
  stage: EscalationStage | null;

  @ApiProperty({ nullable: true, type: Date, example: null })
  lastEscalatedAt: Date | null;
}

export class MarketerOverviewDto {
  @ApiProperty({ type: [WaitingItemDto], description: 'What waits on an admin, oldest first' })
  waiting: WaitingItemDto[];
}

export class MarketerRepaymentsQueryDto {
  @ApiPropertyOptional({
    example: '2026-09',
    description: 'Payroll month (YYYY-MM); defaults to the latest month your customers had deductions in',
  })
  @IsOptional()
  @Matches(YM_PATTERN, { message: '$property must be a month as YYYY-MM' })
  period?: string;
}

class MarketerPeriodDto {
  @ApiProperty({ example: '2026-09' })
  ym: string;

  @ApiProperty({ example: 'SEPTEMBER 2026' })
  label: string;
}

export class MarketerRepaymentOverviewDto {
  @ApiProperty({ type: MarketerPeriodDto })
  period: MarketerPeriodDto;

  @ApiProperty({ example: 450000, description: 'What payroll was asked to deduct from your customers' })
  expected: number;

  @ApiProperty({ example: 380000, description: 'What came in against it' })
  collected: number;

  @ApiProperty({
    example: { OPEN: 0, AWAITING: 0, FULFILLED: 12, PARTIAL: 2, FAILED: 1 },
    description: 'Deductions by status',
  })
  counts: Record<DeductionStatus, number>;
}
