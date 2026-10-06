import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
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

/** POST /admin/payroll-variations/generate: email a draft of the month's file to the signed-in admin. */
export class GenerateVariationDto extends PeriodQueryDto {}

/** POST /admin/payroll-variations/revert: undo a submission sent by mistake. */
export class RevertVariationDto extends PeriodQueryDto {
  @ApiProperty({ example: 'Generated instead of requesting a draft', description: 'Why: kept in the audit log' })
  @Transform(({ value }: { value?: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5, { message: 'Say why the variation is being reverted' })
  @MaxLength(300)
  reason: string;

  @ApiProperty({ example: '123456', description: "The super admin's current authenticator code" })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from your authenticator app' })
  code: string;
}
