import { ApiProperty } from '@nestjs/swagger';
import { RepaymentStatus } from '@prisma/client';

export class RepaymentOverviewDto {
  @ApiProperty({
    example: 150000,
    description: 'Total amount expected to be repaid across all active loans.',
  })
  totalExpected: number;

  @ApiProperty({
    example: 150000,
    description: 'Total amount overdue',
  })
  totalOverdue: number;

  @ApiProperty({
    example: 90000,
    description: 'Total amount that has been repaid so far.',
  })
  totalRepaid: number;

  @ApiProperty({
    example: 2,
    description:
      'Number of repayments that were made but were less than the expected amount.',
  })
  underpaidCount: number;

  @ApiProperty({
    example: 1,
    description:
      'Number of repayment attempts that failed (no money recovered from the sheet for that user).',
  })
  failedDeductionsCount: number;
}
export class RepaymentsResponseDto {
  @ApiProperty({
    example: 'repay_01HE7F35NSD4WXPWD7F1K2T9VA',
    description: 'Unique identifier for the repayment record.',
  })
  id: string;

  @ApiProperty({
    example: 'user_01HDT1M82JGH6SVP3X08GZPKVE',
    description: 'Identifier of the user who made this repayment.',
  })
  userId: string;

  @ApiProperty({
    example: '2025-06',
    description:
      'The repayment period (e.g., year-month) the repayment is for.',
  })
  period: string;

  @ApiProperty({
    example: 25000,
    description: 'The amount expected to be repaid for the period.',
  })
  expectedAmount: number;

  @ApiProperty({
    example: 20000,
    description: 'The actual amount repaid by the user for the period.',
  })
  repaidAmount: number;

  @ApiProperty({
    enum: RepaymentStatus,
    example: RepaymentStatus.AWAITING,
    description:
      'The repayment status — whether fully paid, awaiting, failed, etc.',
  })
  status: RepaymentStatus;
}

export class SingleRepaymentWithUserDto {
  @ApiProperty({
    example: 'repay_01HE7F35NSD4WXPWD7F1K2T9VA',
    description: 'Unique identifier for the repayment record.',
  })
  id: string;

  @ApiProperty({
    example: 'user_01HDT1M82JGH6SVP3X08GZPKVE',
    description: 'Identifier of the user who made this repayment.',
  })
  userId: string;

  @ApiProperty({
    example: '2025-06',
    description:
      'The repayment period (e.g., year-month) the repayment corresponds to.',
  })
  period: string;

  @ApiProperty({
    example: 25000,
    description: 'The amount expected to be repaid for this period.',
  })
  expectedAmount: number;

  @ApiProperty({
    example: 20000,
    description: 'The amount actually repaid by the user.',
  })
  repaidAmount: number;

  @ApiProperty({
    enum: RepaymentStatus,
    example: RepaymentStatus.AWAITING,
    description: 'The status of the repayment.',
  })
  status: RepaymentStatus;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Full name of the user who made the repayment.',
  })
  userName: string;
}
