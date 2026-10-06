import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { DeductionStatus, PaymentInflowSource, PaymentInflowState } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { IsMoney, PaginatedQueryDto, PeriodQueryDto, PeriodRangeQueryDto } from 'src/common/dto';
import { YM_PATTERN } from 'src/common/dto/period.dto';

const trim = ({ value }: { value?: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * GET /admin/repayments/inflows (and its export): PaymentInflow rows, i.e. money received from payroll or
 * a liquidation, filtered by buildInflowWhere (src/admin/repayments/repayment-filters.ts).
 */
export class FilterRepaymentsDto extends IntersectionType(PaginatedQueryDto, PeriodRangeQueryDto) {
  @ApiPropertyOptional({
    description: "Customer name, email, phone number, customer id or IPPIS number, or the sheet's staff ID",
    example: 'jane@example.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  search?: string;

  @ApiPropertyOptional({ enum: PaymentInflowState, example: PaymentInflowState.REVIEWING })
  @IsOptional()
  @IsEnum(PaymentInflowState)
  state?: PaymentInflowState;

  @ApiPropertyOptional({ enum: PaymentInflowSource, example: PaymentInflowSource.PAYROLL })
  @IsOptional()
  @IsEnum(PaymentInflowSource)
  source?: PaymentInflowSource;

  @IsMoney({ optional: true, example: 5000, description: 'Amount received, at least' })
  amountMin?: number;

  @IsMoney({ optional: true, example: 100000, description: 'Amount received, at most' })
  amountMax?: number;

  @ApiPropertyOptional({ example: 'MB-HOWP2', description: "Only this customer's payments" })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Only the rows of this payroll upload' })
  @IsOptional()
  @IsString()
  uploadId?: string;
}

const SEARCH_DESCRIPTION = 'Customer name, email, phone number, customer id or IPPIS number, or a loan id';

/** GET /admin/repayments/deductions: what each loan is expected to pay per payroll month. */
export class FilterDeductionsDto extends IntersectionType(PaginatedQueryDto, PeriodRangeQueryDto) {
  @ApiPropertyOptional({ example: '2026-06', description: 'One payroll month (YYYY-MM); replaces `from`/`to`' })
  @IsOptional()
  @Matches(YM_PATTERN, { message: '$property must be a month as YYYY-MM' })
  period?: string;

  @ApiPropertyOptional({ enum: DeductionStatus, example: DeductionStatus.PARTIAL })
  @IsOptional()
  @IsEnum(DeductionStatus)
  status?: DeductionStatus;

  @ApiPropertyOptional({ description: SEARCH_DESCRIPTION, example: 'jane@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  search?: string;

  @ApiPropertyOptional({ example: 'MB-HOWP2', description: "Only this customer's deductions" })
  @IsOptional()
  @IsString()
  customerId?: string;
}

/** GET /admin/repayments/applied: payments applied to loans (Repayment rows). */
export class FilterAppliedRepaymentsDto extends IntersectionType(PaginatedQueryDto, PeriodRangeQueryDto) {
  @ApiPropertyOptional({ example: '2026-06', description: 'One payroll month (YYYY-MM); replaces `from`/`to`' })
  @IsOptional()
  @Matches(YM_PATTERN, { message: '$property must be a month as YYYY-MM' })
  period?: string;

  @ApiPropertyOptional({ description: `${SEARCH_DESCRIPTION}, or a payment id`, example: 'LN-4KD8QZ' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  search?: string;

  @ApiPropertyOptional({ example: 'MB-HOWP2', description: "Only this customer's repayments" })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ example: 'LN-4KD8QZ', description: 'Only this loan' })
  @IsOptional()
  @IsString()
  loanId?: string;
}

/** A customer's liquidation requests (PaymentInflow LIQUIDATION rows). */
export class FilterLiquidationRequestsDto extends PaginatedQueryDto {
  @ApiPropertyOptional({ enum: PaymentInflowState, example: PaymentInflowState.AWAITING })
  @IsOptional()
  @IsEnum(PaymentInflowState)
  state?: PaymentInflowState;
}

/** A payroll month in a request body: `{ "period": "2026-06" }`. */
export class PeriodDto extends PeriodQueryDto {}

export const MANUAL_RESOLUTION_ACTIONS = ['APPLY', 'SETTLE', 'REJECT'] as const;
export type ManualResolutionAction = (typeof MANUAL_RESOLUTION_ACTIONS)[number];

export class ManualRepaymentResolutionDto {
  @ApiProperty({
    enum: MANUAL_RESOLUTION_ACTIONS,
    example: 'APPLY',
    description:
      "APPLY: pay it into a customer's active loan (UNMATCHED, or REVIEWING with nothing applied yet). " +
      'SETTLE: close a REVIEWING overpayment once the excess has been refunded. ' +
      'REJECT: drop a payment that belongs to no loan (nothing applied yet).',
  })
  @IsIn(MANUAL_RESOLUTION_ACTIONS)
  action: ManualResolutionAction;

  @ApiPropertyOptional({ example: 'MB-HOWP2', description: 'Required for APPLY: the customer the money is from' })
  @ValidateIf((dto: ManualRepaymentResolutionDto) => dto.action === 'APPLY')
  @IsString()
  @IsNotEmpty({ message: 'Choose the customer this payment belongs to' })
  customerId?: string;

  @ApiPropertyOptional({
    example: 'Refunded ₦2,500 to the customer by transfer on 3 July',
    description: 'Required for SETTLE (how the excess was refunded) and REJECT (why); kept in the audit log',
  })
  @ValidateIf((dto: ManualRepaymentResolutionDto) => dto.action !== 'APPLY' || dto.note !== undefined)
  @IsString()
  @Transform(trim)
  @IsNotEmpty({ message: 'Add a note explaining this decision' })
  @MaxLength(1000)
  note?: string;
}

export class RejectLiquidationDto {
  @ApiProperty({
    example: 'The transfer receipt does not match the amount',
    description: 'Why it was rejected (required); kept in the audit log and shown to the customer',
  })
  @IsString()
  @Transform(trim)
  @IsNotEmpty({ message: 'Say why the liquidation is rejected' })
  @MaxLength(1000)
  note: string;
}
