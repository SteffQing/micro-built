import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanStatus, LoanType } from '@prisma/client';

class PendingLoan {
  @ApiProperty({ example: 140000 })
  amount: number;

  @ApiProperty({ example: 'LN-W03D0Q' })
  id: string;

  @ApiProperty({ example: new Date() })
  date: Date;
}

export class PendingLoanAndLoanCountResponseDto {
  @ApiProperty({ type: [PendingLoan] })
  pendingLoans: Array<PendingLoan>;

  @ApiProperty({ example: 2 })
  rejectedCount: number;

  @ApiProperty({ example: 1 })
  approvedCount: number;

  @ApiProperty({ example: 2 })
  disbursedCount: number;
}

class LoanHistoryItem {
  @ApiProperty({ example: 'LN-OE402K' })
  id: string;

  @ApiProperty({ example: 30000 })
  amount: number;

  @ApiProperty({ example: LoanType.CASH })
  loanType: LoanType;

  @ApiProperty({ example: 'PENDING' })
  status: LoanStatus;

  @ApiProperty({ example: new Date().toISOString() })
  date: Date;
}

export class LoanHistoryResponseDto {
  @ApiProperty({
    example: {
      total: 22,
      page: 1,
      limit: 10,
    },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
  };

  @ApiProperty({ type: [LoanHistoryItem] })
  data: {
    loans: LoanHistoryItem[];
  };
}

export class LoanHistoryRequestDto {
  @ApiProperty({ example: 2 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}
