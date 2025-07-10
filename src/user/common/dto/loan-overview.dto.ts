import { ApiProperty } from '@nestjs/swagger';

export class LoanOverviewDto {
  @ApiProperty({ example: 50000 })
  activeLoanAmount: number;

  @ApiProperty({ example: 20000 })
  activeLoanRepaid: number;

  @ApiProperty({ example: 1 })
  overdueLoansCount: number;

  @ApiProperty({ example: 2 })
  pendingLoanRequestsCount: number;

  @ApiProperty({
    example: { amount: 5000, date: '2025-06-01T00:00:00.000Z' },
    nullable: true,
  })
  lastDeduction: { amount: number; date: string } | null;

  @ApiProperty({
    example: '2025-07-01T00:00:00.000Z',
    nullable: true,
  })
  nextRepaymentDate: string | null;
}
