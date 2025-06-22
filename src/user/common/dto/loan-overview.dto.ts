import { ApiProperty } from '@nestjs/swagger';

export class LoanOverviewDto {
  @ApiProperty({ example: 50000 })
  activeLoanAmount: number;

  @ApiProperty({ example: 20000 })
  amountRepaid: number;

  @ApiProperty({ example: 30000 })
  balanceLeft: number;

  @ApiProperty({ example: 1 })
  overdueLoansCount: number;

  @ApiProperty({ example: 2 })
  pendingLoanRequests: number;

  @ApiProperty({
    example: { amount: 5000, date: '2025-06-01T00:00:00.000Z' },
    nullable: true,
  })
  lastRepayment?: { amount: number; date: string };

  @ApiProperty({
    example: '2025-07-01T00:00:00.000Z',
    nullable: true,
  })
  nextRepaymentDate?: string;
}
