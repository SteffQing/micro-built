import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PeriodQueryDto } from 'src/common/dto';
import type { VariationAction, VariationReason } from 'src/ledger/variation';

export const VARIATION_ACTIONS: VariationAction[] = ['START', 'AMEND', 'STOP'];
export const VARIATION_REASONS: VariationReason[] = ['NEW_LOAN', 'TOPUP', 'LIQUIDATION', 'TENURE_CHANGE', 'DEFAULT'];

/** The most organizations one generate call may name (an installation has a handful; `all` covers the rest). */
export const MAX_GENERATE_ORGANIZATIONS = 200;

/** `?organizationId=`: variations are per organization (PLAN_V2). */
export class OrganizationQueryDto {
  @ApiProperty({ description: 'The organization (GET /admin/organizations)' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;
}

/** GET /admin/variations?organizationId=&period=2026-10&action=&reason= */
export class VariationsQueryDto extends IntersectionType(OrganizationQueryDto, PeriodQueryDto) {
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

/** GET /admin/variations/history?organizationId= */
export class VariationHistoryQueryDto extends OrganizationQueryDto {}

/**
 * POST /admin/variations/generate: name the organizations, or `all` for every one with deductions in the month
 * (the rest are skipped). One of the two, not both.
 */
export class GenerateVariationsDto extends PeriodQueryDto {
  @ApiPropertyOptional({ type: [String], description: 'The organizations to generate for' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_GENERATE_ORGANIZATIONS)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  organizationIds?: string[];

  @ApiPropertyOptional({ description: 'Every organization with deductions in the month; the others are skipped' })
  @IsOptional()
  @IsBoolean()
  all?: boolean;
}

/** POST /admin/variations/draft: email a draft of what generating would produce now, to the signed-in admin. */
export class VariationDraftDto extends IntersectionType(OrganizationQueryDto, PeriodQueryDto) {}

/** GET /admin/variations/:id/file?version= */
export class VariationFileQueryDto {
  @ApiPropertyOptional({ example: 2, description: 'A file version still stored (default: the current one)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;
}
