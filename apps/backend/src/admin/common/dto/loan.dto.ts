import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommodityRequestStatus, LoanCategory, LoanStatus, MicroLoanStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNotIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';
import { IsMoney } from 'src/common/dto/money.dto';

/** Longest tenure (or tenure change) an admin can set: a guard against typos, not a policy. */
export const MAX_TENURE_MONTHS = 120;

/** Query-string booleans arrive as text; exports replay the filters as JSON booleans. */
const toBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class CashLoanQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({
    description: "Search by loan id, or the customer's name, email, phone number, customer id or IPPIS number",
    example: 'john doe',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: LoanStatus, description: 'Filter loans by current status', example: LoanStatus.PENDING })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @ApiPropertyOptional({
    enum: LoanCategory,
    description: 'Filter loans by category (asset loans are listed under commodity requests)',
    example: LoanCategory.PERSONAL,
  })
  @IsOptional()
  @IsEnum(LoanCategory)
  @IsNotIn([LoanCategory.ASSET_PURCHASE], { message: 'Asset loans are listed under commodity requests' })
  category?: LoanCategory;

  @ApiPropertyOptional({ description: 'Minimum principal (naira)', example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  principalMin?: number;

  @ApiPropertyOptional({ description: 'Maximum principal (naira)', example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  principalMax?: number;

  @ApiPropertyOptional({ description: 'Only loans that have been charged a penalty', example: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasPenalties?: boolean;

  @ApiPropertyOptional({ description: 'Only loans with an approved asset (commodity) request', example: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasCommodityLoan?: boolean;

  @ApiPropertyOptional({ description: 'Disbursed on or after this day (Lagos calendar)', example: '2026-06-01' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  disbursementStart?: Date;

  @ApiPropertyOptional({ description: 'Disbursed on or before this day (Lagos calendar)', example: '2026-06-30' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  disbursementEnd?: Date;

  @ApiPropertyOptional({ description: 'Requested on or after this day (Lagos calendar)', example: '2026-05-01' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  requestedStart?: Date;

  @ApiPropertyOptional({ description: 'Requested on or before this day (Lagos calendar)', example: '2026-05-31' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  requestedEnd?: Date;
}

export class CommodityLoanQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({
    description: "Search by request id, commodity name, or the customer's name, email, phone number or IPPIS number",
    example: 'Laptop',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: CommodityRequestStatus, description: 'Filter requests by decision' })
  @IsOptional()
  @IsEnum(CommodityRequestStatus)
  status?: CommodityRequestStatus;

  @ApiPropertyOptional({
    description: 'true = still in review; false = decided (approved or rejected). Prefer `status`.',
    example: true,
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  inReview?: boolean;

  @ApiPropertyOptional({ description: 'Requested on or after this day (Lagos calendar)', example: '2026-05-01' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  requestedStart?: Date;

  @ApiPropertyOptional({ description: 'Requested on or before this day (Lagos calendar)', example: '2026-05-31' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  requestedEnd?: Date;
}

export class LoanTermsDto {
  @ApiProperty({ description: 'Loan tenure in months', example: 6, minimum: 1, maximum: MAX_TENURE_MONTHS })
  @IsInt()
  @Min(1)
  @Max(MAX_TENURE_MONTHS)
  tenure: number;
}

/** Why a loan, asset request or top-up was turned down; kept on its audit entry. */
export class LoanRejectionDto {
  @ApiPropertyOptional({ description: 'Reason, kept in the audit log', example: 'Net pay too low for this amount' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AcceptCommodityLoanDto {
  @ApiProperty({
    description: 'Details the customer sees',
    example: 'HP EliteBook 840 G8, delivered to your office within 7 days',
  })
  @IsString()
  @IsNotEmpty()
  publicDetails: string;

  @ApiProperty({
    description: 'Internal notes (vendor, cost, market research); admins only',
    example: 'Bought from Slot Ikeja at ₦410,000',
  })
  @IsString()
  @IsNotEmpty()
  privateDetails: string;

  @IsMoney({ example: 450000, description: 'What the customer borrows for the asset (naira)' })
  amount: number;

  @ApiPropertyOptional({
    description: 'Months to repay. Required for a new asset loan; not allowed on a top-up (send monthsDelta)',
    example: 12,
    minimum: 1,
    maximum: MAX_TENURE_MONTHS,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_TENURE_MONTHS)
  tenure?: number;

  @ApiPropertyOptional({
    description: "Top-up only: months to add to (or, negative, remove from) the running loan's tenure",
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @NotEquals(0, { message: 'monthsDelta must not be 0' })
  @Min(-MAX_TENURE_MONTHS)
  @Max(MAX_TENURE_MONTHS)
  monthsDelta?: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'Top-up only, with monthsDelta > 0: when it is disbursed, also book interest on the running loan for the ' +
      'added months (principal still owed × rate × months)',
  })
  @IsOptional()
  @IsBoolean()
  reprice?: boolean;
}

export class ApproveTopupDto {
  @ApiPropertyOptional({
    description:
      'Replace the tenure change requested with the top-up: months to add (negative: remove); 0 or null drops ' +
      'it. Absent: keep what was requested.',
    example: 2,
    nullable: true,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(-MAX_TENURE_MONTHS)
  @Max(MAX_TENURE_MONTHS)
  monthsDelta?: number | null;

  @ApiPropertyOptional({
    description:
      'With a change that adds months: on disbursement also book interest on the running loan for them. ' +
      'Absent: keep what was requested.',
  })
  @IsOptional()
  @IsBoolean()
  reprice?: boolean;
}

export class TopupQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({ enum: MicroLoanStatus, description: 'Filter top-ups by status', example: 'PENDING' })
  @IsOptional()
  @IsEnum(MicroLoanStatus)
  status?: MicroLoanStatus;
}
