import { ApiProperty } from '@nestjs/swagger';
import { LoanCategory, LoanStatus } from '@prisma/client';

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

export class LoanHistoryItem {
  @ApiProperty({ example: 'LN-OE402K' })
  id: string;

  @ApiProperty({ example: 30000 })
  amount: number;

  @ApiProperty({ example: 'PENDING' })
  status: LoanStatus;

  @ApiProperty({ example: 'EDUCATION' })
  category: LoanCategory;

  @ApiProperty({ example: new Date().toISOString() })
  date: Date;
}

export class LoanHistoryRequestDto {
  @ApiProperty({ example: 2 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}
