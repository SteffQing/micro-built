import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { fromPercent, toPercent } from '../rates';
import type { SettingsChanges, SettingsValues } from '../settings.service';

const PERCENT = { maxDecimalPlaces: 2 } as const;

// Every rate is a percentage with up to 2 decimals (the column keeps 4 as a fraction). Rates
// can't be unset once saved (null is rejected); only the net-pay cap can be switched off.
export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 6, description: 'Monthly interest rate, percent of principal' })
  @ValidateIf((_, value) => value !== undefined)
  @IsNumber(PERCENT)
  @Min(0)
  @Max(100)
  interestRate?: number;

  @ApiPropertyOptional({ example: 2.5, description: 'Management fee, percent of each disbursement' })
  @ValidateIf((_, value) => value !== undefined)
  @IsNumber(PERCENT)
  @Min(0)
  @Max(100)
  managementFeeRate?: number;

  @ApiPropertyOptional({ example: 10, description: 'Penalty, percent of a deduction shortfall' })
  @ValidateIf((_, value) => value !== undefined)
  @IsNumber(PERCENT)
  @Min(0)
  @Max(100)
  penaltyRate?: number;

  @ApiPropertyOptional({
    example: 33.33,
    nullable: true,
    type: Number,
    description: "Largest share of a customer's net pay the monthly deduction may take, percent; null turns the cap off",
  })
  @IsOptional()
  @IsNumber(PERCENT)
  @Min(1)
  @Max(100)
  maxDeductionRate?: number | null;
}

export function toSettingsChanges(dto: UpdateSettingsDto): SettingsChanges {
  const rate = (percent: number | undefined) => (percent === undefined ? undefined : fromPercent(percent));
  return {
    interestRate: rate(dto.interestRate),
    managementFeeRate: rate(dto.managementFeeRate),
    penaltyRate: rate(dto.penaltyRate),
    maxDeductionRate: dto.maxDeductionRate === null ? null : rate(dto.maxDeductionRate),
  };
}

export class SettingsDto {
  @ApiProperty({ example: 6, nullable: true, type: Number, description: 'Percent; null until set' })
  interestRate: number | null;

  @ApiProperty({ example: 2.5, nullable: true, type: Number, description: 'Percent; null until set' })
  managementFeeRate: number | null;

  @ApiProperty({ example: 10, nullable: true, type: Number, description: 'Percent; null until set' })
  penaltyRate: number | null;

  @ApiProperty({ example: 33.33, nullable: true, type: Number, description: 'Percent; null = no cap' })
  maxDeductionRate: number | null;

  @ApiProperty({ example: false })
  inMaintenance: boolean;
}

export function toSettingsDto(settings: SettingsValues): SettingsDto {
  return {
    interestRate: toPercent(settings.interestRate),
    managementFeeRate: toPercent(settings.managementFeeRate),
    penaltyRate: toPercent(settings.penaltyRate),
    maxDeductionRate: toPercent(settings.maxDeductionRate),
    inMaintenance: settings.inMaintenance,
  };
}

// GET /config keeps its v1 field names (penaltyFeeRate, maintenanceMode) for the frontend.
export class PublicConfigDto {
  @ApiProperty({ example: false })
  maintenanceMode: boolean;

  @ApiProperty({ example: 6, nullable: true, type: Number, description: 'Percent; null until set' })
  interestRate: number | null;

  @ApiProperty({ example: 2.5, nullable: true, type: Number, description: 'Percent; null until set' })
  managementFeeRate: number | null;

  @ApiProperty({ example: 10, nullable: true, type: Number, description: 'Percent; null until set' })
  penaltyFeeRate: number | null;

  @ApiProperty({ example: 33.33, nullable: true, type: Number, description: 'Percent; null = no cap' })
  maxDeductionRate: number | null;

  @ApiProperty({ example: ['Laptop', 'Solar Panel'], description: 'Active commodity names' })
  commodities: string[];
}
