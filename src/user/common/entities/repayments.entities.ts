import { ApiProperty } from '@nestjs/swagger';
import { RepaymentStatus } from '@prisma/client';

export class RepaymentOverviewResponseDto {
  @ApiProperty({ example: 5 })
  repaymentsCount: number;

  @ApiProperty({ example: 2 })
  flaggedRepaymentsCount: number;

  @ApiProperty({
    example: { amount: 1000, date: '2025-05-10T00:00:00.000Z' },
    nullable: true,
  })
  lastRepayment: { amount: number; date: Date } | null;

  @ApiProperty({ example: '2025-06-10T00:00:00.000Z', nullable: true })
  nextRepaymentDate: Date | null;

  @ApiProperty({ example: 150000 })
  overdueAmount: number;
}

export class RepaymentHistoryItem {
  @ApiProperty({ example: 'RP-KD9032' })
  id: string;

  @ApiProperty({ example: 5000 })
  repaid: number;

  @ApiProperty({ example: 5000 })
  expected: number;

  @ApiProperty({ example: RepaymentStatus.AWAITING })
  status: RepaymentStatus;

  @ApiProperty({ example: 'APRIL 2025' })
  period: string;

  @ApiProperty({ example: '2025-04-01T00:00:00.000Z' })
  date: Date;

  @ApiProperty({ example: 'LN-45A678', nullable: true })
  loanId: string | null;
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

export class SingleUserRepaymentDto {
  @ApiProperty({ example: 'RP-KD9032' })
  id: string;

  @ApiProperty({ example: 5000 })
  repaidAmount: number;

  @ApiProperty({ example: 5000 })
  penaltyCharge: number;

  @ApiProperty({ example: 5000 })
  expectedAmount: number;

  @ApiProperty({ example: 'APRIL 2025' })
  period: string;

  @ApiProperty({ example: RepaymentStatus.AWAITING })
  status: RepaymentStatus;

  @ApiProperty({ example: 'LN-45AK78', nullable: true })
  loanId: string | null;
}
