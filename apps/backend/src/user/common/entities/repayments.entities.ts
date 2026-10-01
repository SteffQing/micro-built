import { ApiProperty } from '@nestjs/swagger';
import { DeductionStatus, PaymentInflowSource } from '@prisma/client';
import { UserLastDeductionDto, UserNextDeductionDto } from './user.entities';

// The customer's copy of a repayment: no principal/interest/penalty split (statements leave it
// out for customers too).

export class UserRepaymentDto {
  @ApiProperty({ example: 'cm1x2y3z40000abcd' })
  id: string;

  @ApiProperty({ example: 'LN-Q30E22' })
  loanId: string;

  @ApiProperty({ example: 22500 })
  amount: number;

  @ApiProperty({ example: '2026-06-28T10:00:00.000Z', description: 'When the payment was applied' })
  date: Date;

  @ApiProperty({ example: 'JUNE 2026', description: 'Payroll month the payment belongs to' })
  period: string;

  @ApiProperty({ enum: PaymentInflowSource, example: PaymentInflowSource.PAYROLL })
  source: PaymentInflowSource;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 22500,
    description: 'Payroll payments: the deduction payroll was asked for that month; null for a liquidation',
  })
  expected: number | null;

  @ApiProperty({
    nullable: true,
    enum: DeductionStatus,
    example: DeductionStatus.FULFILLED,
    description: 'Payroll payments: FULFILLED or PARTIAL; null for a liquidation',
  })
  deductionStatus: DeductionStatus | null;
}

export class UserRepaymentMonthDto {
  @ApiProperty({ example: 'JUNE 2026' })
  period: string;

  @ApiProperty({ example: 22500, description: 'Total repaid for that payroll month (0 if nothing)' })
  amount: number;
}

export class UserRepaymentsOverviewDto {
  @ApiProperty({ example: 135000, description: 'Everything repaid on every loan' })
  totalRepaid: number;

  @ApiProperty({ example: 90000, description: 'Still owed on the running loan (0 if none)' })
  outstanding: number;

  @ApiProperty({ example: 6 })
  repaymentsCount: number;

  @ApiProperty({ example: 1, description: 'Payroll months that came in short or not at all' })
  missedCount: number;

  @ApiProperty({
    type: UserNextDeductionDto,
    nullable: true,
    description: 'This month’s deduction: what payroll will be asked for, and the payroll month it is for',
  })
  thisMonth: UserNextDeductionDto | null;

  @ApiProperty({ type: UserLastDeductionDto, nullable: true, description: 'The latest repayment' })
  lastRepayment: UserLastDeductionDto | null;

  @ApiProperty({
    type: [UserRepaymentMonthDto],
    description: 'Repaid per payroll month for the 12 months up to the current one, oldest first',
  })
  chart: UserRepaymentMonthDto[];
}
