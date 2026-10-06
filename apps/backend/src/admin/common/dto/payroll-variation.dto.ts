import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PeriodQueryDto } from 'src/common/dto';
import type { VariationAction, VariationReason } from 'src/ledger/variation';

export const VARIATION_ACTIONS: VariationAction[] = ['START', 'AMEND', 'STOP'];
export const VARIATION_REASONS: VariationReason[] = ['NEW_LOAN', 'TOPUP', 'LIQUIDATION', 'TENURE_CHANGE', 'DEFAULT'];

/** GET /admin/payroll-variations?period=2026-06&action=&reason= */
export class PayrollVariationPreviewDto extends PeriodQueryDto {
  @ApiPropertyOptional({ enum: VARIATION_ACTIONS, description: 'Only rows with this action' })
  @IsOptional()
  @IsIn(VARIATION_ACTIONS)
  action?: VariationAction;

  @ApiPropertyOptional({
    enum: VARIATION_REASONS,
    description: 'Only rows that changed for this reason since payroll was last sent an amount',
  })
  @IsOptional()
  @IsIn(VARIATION_REASONS)
  reason?: VariationReason;
}

/** POST /admin/payroll-variations/generate: email a draft of the month's file. */
export class GenerateVariationDto extends PeriodQueryDto {
  @ApiPropertyOptional({
    example: 'payroll@example.com',
    description: "Where to send the draft; defaults to the signed-in admin's email",
  })
  @IsOptional()
  @Transform(({ value }: { value?: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address' })
  email?: string;
}

/** POST /admin/payroll-variations/revert: undo a submission sent by mistake. */
export class RevertVariationDto extends PeriodQueryDto {
  @ApiProperty({ description: "The super admin's own password, re-entered to confirm" })
  @IsString()
  @IsNotEmpty({ message: 'Enter your password to confirm' })
  password: string;

  @ApiProperty({ example: 'Submitted instead of requesting a draft', description: 'Why: kept in the audit log' })
  @Transform(({ value }: { value?: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5, { message: 'Say why the submission is being reverted' })
  @MaxLength(300)
  reason: string;
}
