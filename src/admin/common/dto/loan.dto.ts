import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { LoanCategory, LoanStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MetaDto } from 'src/common/dto';

export class CashLoanQueryDto {
  @ApiPropertyOptional({
    enum: LoanStatus,
    description: 'Filter loans by the loan current status',
    example: LoanStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Page number for pagination (starts from 1)',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Number of items to return per page',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  limit?: number = 20;
}

export class CommodityLoanQueryDto {
  @ApiPropertyOptional({
    description: 'Search commodity loan requests by name',
    example: 'Laptop',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter commodity loans by the loan current status',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  inReview?: boolean;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Page number for pagination (starts from 1)',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Number of items to return per page',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  limit?: number = 20;
}

export class LoanTermsDto {
  @ApiProperty({
    description: 'Loan tenure in months',
    example: 6,
  })
  @IsInt()
  @Min(1)
  tenure: number;
}

export class AcceptCommodityLoanDto {
  @ApiProperty({
    description: 'Public loan details visible to the customer',
    example: 'Loan for purchase of farming equipment',
  })
  @IsString()
  @IsNotEmpty()
  publicDetails: string;

  @ApiProperty({
    description: 'Private internal notes or justification for the loan',
    example: 'Requested to aid maize cultivation in 2025 Q1 season',
  })
  @IsString()
  @IsNotEmpty()
  privateDetails: string;

  @ApiProperty({
    description:
      'Amount denominated for the commodity purchase as a loan in Naira',
    example: 250000,
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Loan tenure in months',
    example: 6,
  })
  @IsInt()
  @Min(1)
  tenure: number;

  @ApiProperty({
    description: 'Management fee rate in percentage',
    example: 6,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  managementFeeRate: number;
}

class CashLoanItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 25000 })
  amount: number;

  @ApiProperty({ example: '2025-06-28T12:00:00Z' })
  date: Date;

  @ApiProperty()
  customerId: string;

  @ApiProperty({ enum: LoanCategory })
  category: LoanCategory;

  @ApiProperty({ example: 6 })
  loanTenure: number;

  @ApiProperty({ enum: LoanStatus })
  status: LoanStatus;
}

class CommodityLoanItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '2025-06-28T12:00:00Z' })
  date: Date;

  @ApiProperty()
  customerId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: true })
  inReview: boolean;

  @ApiProperty()
  loanId: string | null;
}

@ApiExtraModels(CashLoanItemDto, MetaDto)
export class CashLoanItemsDto {
  @ApiProperty({
    type: [CashLoanItemDto],
    description: 'List of cash loans filtered by the given query',
  })
  data: CashLoanItemDto[];

  @ApiProperty({ type: 'string', example: 'Cash loans retrieved successfully' })
  message: string;

  @ApiProperty({
    type: MetaDto,
    description: 'Meta object, used to show page detaails',
  })
  meta: MetaDto;
}

@ApiExtraModels(CommodityLoanItemDto, MetaDto)
export class CommodityLoanItemsDto {
  @ApiProperty({
    type: [CommodityLoanItemDto],
    description: 'List of commodity loans filtered by the given query',
  })
  data: CommodityLoanItemDto[];

  @ApiProperty({
    type: 'string',
    example: 'Commodity loans retrieved successfully',
  })
  message: string;

  @ApiProperty({
    type: MetaDto,
    description: 'Meta object, used to show page details',
  })
  meta: MetaDto;
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
    example: 0.025,
    description: 'Management fee rate (e.g., 0.025 = 2.5%)',
  })
  managementFeeRate: number;

  @ApiProperty({
    example: 0.03,
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
