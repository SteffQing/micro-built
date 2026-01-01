import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LiquidationStatus, RepaymentStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';

export class FilterRepaymentsDto extends PaginatedQueryDto {
  @ApiPropertyOptional({
    enum: RepaymentStatus,
    example: RepaymentStatus.AWAITING,
  })
  @IsOptional()
  @IsEnum(RepaymentStatus)
  status?: RepaymentStatus;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter repayments with penalty charge',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  hasPenaltyCharge?: boolean;

  @ApiPropertyOptional({
    description: 'Search payer by name or email address',
    example: 'jane@example.com',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: '2022-01-01',
    description: 'Filter repayments created after this date (ISO-8601)',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  periodStart?: Date;

  @ApiPropertyOptional({
    example: '2022-01-31',
    description: 'Filter repayments created before this date (ISO-8601)',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  periodEnd?: Date;

  @ApiPropertyOptional({
    example: 500,
    description:
      'Filter repayments with repaid amount greater than or equal to this value',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  repaidAmountMin?: number;

  @ApiPropertyOptional({
    example: 1000,
    description:
      'Filter repayments with repaid amount less than or equal to this value',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  repaidAmountMax?: number;
}
export class FilterLiquidationRequestsDto {
  @ApiPropertyOptional({
    enum: LiquidationStatus,
    example: LiquidationStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(LiquidationStatus)
  status?: LiquidationStatus;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Page number for pagination (starts from 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Number of items to return per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number = 20;
}

export class UploadRepaymentReportDto {
  @ApiProperty({
    example: 'APRIL 2025',
    description: 'Date period this repayment document is uploaded for',
  })
  @IsString()
  @Matches(
    /^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s\d{4}$/i,
    {
      message:
        'Period must be in the format "MONTH YYYY", where MONTH is January-December (uppercase) and YYYY is a valid year',
    },
  )
  period: string;
}

export class ManualRepaymentResolutionDto {
  @ApiProperty({
    description: 'Resolution note for manual update',
    example: 'Adjusted after bank reconciliation',
  })
  @IsString()
  resolutionNote: string;

  @ApiPropertyOptional({ description: 'Associated user ID' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Associated loan ID' })
  @IsString()
  @IsOptional()
  loanId?: string;
}
