import { ApiProperty } from '@nestjs/swagger';

export class RecentActivityDto {
  @ApiProperty({ example: 'Loan Repayment' })
  title: string;

  @ApiProperty({ example: '₦25000 used to repay loan LN-E111.' })
  description: string;

  @ApiProperty({ example: '20 Apr 2025', format: 'date-time' })
  date: Date;

  @ApiProperty({
    example: 'Repayment',
    description: 'The source of this activity',
  })
  source: string;
}
