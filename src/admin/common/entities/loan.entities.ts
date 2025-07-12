import { ApiProperty } from '@nestjs/swagger';
import { LoanCategory, LoanStatus } from '@prisma/client';

export class CashLoanItemDto {
  @ApiProperty({
    example: 'LN-D2B10D',
    description: 'unique id of the loan request',
  })
  id: string;

  @ApiProperty({
    example: '2025-06-28T12:00:00Z',
    description: 'Date in which the request was made',
  })
  date: Date;

  @ApiProperty({ example: 25000, description: 'Amount requested by the user' })
  amount: number;

  @ApiProperty({
    example: 'MB-29DM3',
    description: 'The id of the customer requesting the loan',
  })
  customerId: string;

  @ApiProperty({
    enum: LoanCategory,
    example: LoanCategory.EDUCATION,
    description: 'Category in which the loan request falls',
  })
  category: LoanCategory;

  @ApiProperty({
    example: 6,
    description: 'Length of the loan repaayment in months',
  })
  loanTenure: number;

  @ApiProperty({
    enum: LoanStatus,
    example: LoanStatus.PENDING,
    description: 'State of the loan request',
  })
  status: LoanStatus;
}

export class CommodityLoanItemDto {
  @ApiProperty({
    example: 'CLN-D2B10D',
    description: 'unique id of the asset loan request',
  })
  id: string;

  @ApiProperty({
    example: '2025-06-28T12:00:00Z',
    description: 'Date in which the request was made',
  })
  date: Date;

  @ApiProperty({
    example: 'MB-29DM3',
    description: 'The id of the customer requesting the loan',
  })
  customerId: string;

  @ApiProperty({
    example: 'Laptop',
    description: 'Name of the commodity item being requested',
  })
  name: string;

  @ApiProperty({
    example: true,
    description: 'State of the commodity loan request',
  })
  inReview: boolean;

  @ApiProperty({
    example: 'LN-C03S2O',
    description: 'Loan object attached to the commodity loan request',
  })
  loanId: string | null;
}
