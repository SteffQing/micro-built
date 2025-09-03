import { ApiProperty } from '@nestjs/swagger';
import { LiquidationStatus, Prisma, RepaymentStatus } from '@prisma/client';

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
    example: 'RP-001HE7',
    description: 'Unique identifier for the repayment record.',
  })
  id: string;

  @ApiProperty({
    example: 'MB-K9SJ72',
    description: 'Identifier of the user who made this repayment.',
  })
  userId: string | null;

  @ApiProperty({
    example: 'APRIL 2025',
    description: 'The repayment period (i.e MONTH YEAR) the repayment is for.',
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

  @ApiProperty({
    example: 'LN-001HE7',
    description: 'Unique identifier for the associated loan record.',
    nullable: true,
  })
  loanId: string | null;
}

class UserWithRepayment {
  @ApiProperty({
    example: 'MB-001HE7',
    description: 'Unique identifier of the user',
    nullable: true,
  })
  id: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Name of the user who made this repayment.',
  })
  name: string;

  @ApiProperty({
    example: 100,
    description: 'The rate of repayment in % value.',
  })
  repaymentRate: number;
}

export class SingleRepaymentWithUserDto {
  @ApiProperty({
    example: 'RP-LK0A0Q',
    description: 'Unique identifier for the repayment record.',
  })
  id: string;

  @ApiProperty({
    example: 'APRIL 2025',
    description: 'The repayment period (i.e MONTH YEAR) the repayment is for.',
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
    description:
      'User associated with the repayment. Null if user does not exist!',
    nullable: true,
  })
  user: UserWithRepayment | null;

  @ApiProperty({
    example: 'LN-001HE7',
    description: 'Unique identifier for the associated loan record.',
    nullable: true,
  })
  loanId: string | null;

  @ApiProperty({
    example: 'LN-001HE7',
    description: 'Unique identifier for the associated loan record.',
    nullable: true,
  })
  failureNote: string | null;

  @ApiProperty({
    example: 'LN-001HE7',
    description: 'Unique identifier for the associated loan record.',
    nullable: true,
  })
  resolutionNote: string | null;
}

export class CustomerLiquidationRequestsDto {
  @ApiProperty({
    example: 'LR-J99Q1A',
    description: 'Unique identifier of the liquidation request.',
  })
  id: string;

  @ApiProperty({
    example: LiquidationStatus.PENDING,
    description: 'Current status of the liquidation request.',
    enum: LiquidationStatus,
  })
  status: LiquidationStatus;

  @ApiProperty({
    example: 1200.5,
    description: 'Total amount for liquidation.',
  })
  amount: number;

  @ApiProperty({
    example: '2025-08-24T10:30:00.000Z',
    description:
      'Date when the liquidation was approved. Null if not yet approved.',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  approvedAt: Date | null;
}
