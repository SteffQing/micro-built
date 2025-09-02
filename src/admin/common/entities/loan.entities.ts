import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CommodityLoanDto {
  @ApiProperty({
    example: 'CLN-S95FGW',
    description: 'ID of the commodity loan',
  })
  id: string;

  @ApiProperty({
    example: 'Bag of Maize',
    description: 'Name of the commodity',
  })
  name: string;

  @ApiProperty({
    example: '2024-01-01T12:00:00Z',
    description: 'Date when the commodity loan was created',
  })
  createdAt: Date;

  @ApiProperty({
    example: true,
    description: 'Whether this commodity loan is still under review',
  })
  inReview: boolean;

  @ApiPropertyOptional({
    example: '50kg of maize provided for loan consideration.',
    description: 'Details visible to the public',
  })
  publicDetails?: string;

  @ApiPropertyOptional({
    example: 'Stored in private warehouse in Kaduna',
    description: 'Confidential/private info about the commodity',
  })
  privateDetails?: string;

  @ApiPropertyOptional({
    example: 'LN-39E02S',
    description: 'ID of the cash loan represented for this',
  })
  loanId?: string;

  @ApiProperty({ example: 'MB-8IO0P1', description: 'User ID of borrower' })
  userId: string;
}

export class CashLoanDto {
  @ApiProperty({ example: 'LN-39E02S', description: 'ID of the loan' })
  id: string;

  @ApiProperty({ example: 100000, description: 'Amount borrowed by the user' })
  amount: number;

  @ApiProperty({
    example: 120000,
    description: 'Total repayable amount including fees',
  })
  amountRepayable: number;

  @ApiProperty({
    example: 30000,
    description: 'Amount already repaid by the user',
  })
  amountRepaid: number;

  @ApiProperty({
    example: 2.5,
    description: 'Management fee rate (e.g., 0.025 = 2.5%)',
  })
  managementFeeRate: number;

  @ApiProperty({
    example: 3,
    description: 'Interest rate (e.g., 0.03 = 3%)',
  })
  interestRate: number;

  @ApiProperty({
    example: LoanStatus.PENDING,
    description: 'Loan approval status',
    enum: LoanStatus,
  })
  status: LoanStatus;

  @ApiProperty({
    example: LoanCategory.AGRICULTURE,
    description: 'Loan category type',
    enum: LoanCategory,
  })
  category: LoanCategory;

  @ApiPropertyOptional({
    example: '2024-06-15T10:30:00Z',
    description: 'Date when loan was disbursed',
  })
  disbursementDate?: Date;

  @ApiProperty({
    example: 6,
    description: 'Loan duration in months',
  })
  loanTenure: number;

  @ApiProperty({
    example: 1,
    description: 'Number of months the loan has been extended',
  })
  extension: number;

  @ApiProperty({
    example: 'MB-IS02K',
    description: 'ID of the borrower',
  })
  borrowerId: string;

  @ApiProperty({
    example: '2024-05-01T08:00:00Z',
    description: 'When the loan record was created',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-06-20T15:45:00Z',
    description: 'When the loan record was last updated',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    type: CommodityLoanDto,
    description: 'Details of the commodity loan (if applicable)',
  })
  asset?: CommodityLoanDto;
}
