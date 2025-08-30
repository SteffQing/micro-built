import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LiquidationStatus, RepaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';

export class FilterRepaymentsDto {
  @ApiPropertyOptional({
    enum: RepaymentStatus,
    example: RepaymentStatus.AWAITING,
  })
  @IsOptional()
  @IsEnum(RepaymentStatus)
  status?: RepaymentStatus;

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
