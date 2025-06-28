import { ApiProperty } from '@nestjs/swagger';
import { MetaDto } from 'src/common/dto';

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

class RepaymentHistoryItem {
  @ApiProperty({ example: 'rpl_12345' })
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

export class RepaymentHistoryResponseDto {
  @ApiProperty({ type: MetaDto })
  meta: MetaDto;

  @ApiProperty({ type: [RepaymentHistoryItem] })
  data: RepaymentHistoryItem[];

  @ApiProperty({ example: 'Repayment history fetched successfully' })
  message: string;
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
