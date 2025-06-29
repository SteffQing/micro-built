import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CashLoanItemDto {
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

export class CommodityLoanItemDto {
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
