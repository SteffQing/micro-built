import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanCategory, LoanStatus } from '@prisma/client';

export class LoanDataDto {
  @ApiProperty({ example: 'LN-123456' })
  id: string;

  @ApiProperty({ example: 150000 })
  amount: number;

  @ApiProperty({ example: 162000 })
  amountRepayable: number;

  @ApiProperty({ example: 162000 })
  amountRepaid: number;

  @ApiProperty({ enum: LoanStatus, example: 'PENDING' })
  status: LoanStatus;

  @ApiProperty({ enum: LoanCategory, example: 'PERSONAL' })
  category: LoanCategory;

  @ApiProperty({ example: 6, description: 'Loan tenure in months' })
  tenure: number;

  @ApiPropertyOptional({
    example: '2025-08-01T00:00:00.000Z',
    required: false,
    description: 'Date loan was disbursed',
  })
  disbursementDate?: Date;

  @ApiPropertyOptional({
    example: 'Laptop',
    required: false,
    description: 'name of asset attached to this loan request',
  })
  assetName?: string;

  @ApiPropertyOptional({
    example: 'CLN-O9W29L',
    required: false,
    description: 'id of asset attached to this loan request',
  })
  assetId?: string;

  @ApiProperty({
    example: '2025-06-01T00:00:00.000Z',
    description: 'Date loan was created',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2025-06-20T00:00:00.000Z',
    description: 'Date loan was last updated',
  })
  updatedAt: Date;
}

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

export class CommodityLoanDataDto {
  @ApiProperty({ example: 'CLN-123456' })
  id: string;

  @ApiProperty({ example: 'Laptop' })
  name: string;

  @ApiProperty({ example: true })
  inReview: boolean;

  @ApiProperty({
    example:
      'Laptop will be sent over to the address provided below: 123 Port Avenue, Lagos state',
  })
  details: string | null;

  @ApiProperty({ example: new Date().toISOString() })
  date: Date;
}

export class AllUserLoansDto {
  @ApiProperty({ example: 'LN-OE402K' })
  id: string;

  @ApiPropertyOptional({ example: 30000 })
  amount?: number;

  @ApiProperty({ example: 'PENDING' })
  status: LoanStatus;

  @ApiProperty({ example: 'EDUCATION' })
  category: LoanCategory;

  @ApiProperty({ example: new Date().toISOString() })
  date: Date;

  @ApiPropertyOptional({ example: 'Laptop' })
  name?: string;

  @ApiProperty({ example: 'LN93JHDS' })
  loanId: string | null;
}

export class AllCommodityLoansDto {
  @ApiProperty({ example: 'CLN-OE402K' })
  id: string;

  @ApiProperty({ example: new Date().toISOString() })
  date: Date;

  @ApiPropertyOptional({ example: 'Laptop' })
  name: string;
}
