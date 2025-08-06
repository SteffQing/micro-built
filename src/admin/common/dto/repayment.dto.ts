import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
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

export class UploadRepaymentReportDto {
  @ApiProperty({
    example: 'APRIL 2025',
    description: 'Date period this repayment document is uploaded for',
  })
  @IsString()
  period: string;
}
