import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RepaymentStatus } from '@prisma/client';

export class RepaymentOverviewResponseDto {
  @ApiProperty({ example: 5 })
  repaymentsCount: number;

  @ApiProperty({ example: 2 })
  flaggedRepaymentsCount: number;

  @ApiProperty({ example: '2025-05-10T00:00:00.000Z', nullable: true })
  lastRepaymentDate: Date | null;

  @ApiProperty({ example: '2025-06-10T00:00:00.000Z', nullable: true })
  nextRepaymentDate: Date | null;

  @ApiProperty({ example: 150000 })
  overdueAmount: number;
}

export class RepaymentHistoryItem {
  @ApiProperty({ example: 'RPL-KD9032' })
  id: string;

  @ApiProperty({ example: 5000 })
  repaid: number;

  @ApiProperty({ example: 'APRIL 2025' })
  period: string;

  @ApiProperty({ example: '2025-04-01T00:00:00.000Z' })
  date: Date;

  @ApiProperty({ example: 'LN_45A678' })
  loanId: string;
}

class MonthlySummaryDto {
  @ApiProperty({ example: 'January' })
  month: string;

  @ApiProperty({ example: 20000 })
  repaid: number;
}
export class RepaymentsSummaryDto {
  @ApiProperty({ type: [MonthlySummaryDto] })
  data: MonthlySummaryDto[];

  @ApiProperty({
    example: 'Monthly repayment summary for ${year} retrieved successfully',
  })
  message: string;
}

export class RepaymentQueryDto {
  @ApiPropertyOptional({
    enum: RepaymentStatus,
    description: 'Filter by repayment status',
    example: RepaymentStatus.AWAITING,
  })
  @IsOptional()
  @IsEnum(RepaymentStatus, {
    message: `status must be one of: ${Object.values(RepaymentStatus).join(', ')}`,
  })
  status?: RepaymentStatus;

  @ApiPropertyOptional({ type: Number, example: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    type: Number,
    example: 10,
    description: 'Items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;
}
