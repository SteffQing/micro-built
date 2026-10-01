import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional } from 'class-validator';
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
