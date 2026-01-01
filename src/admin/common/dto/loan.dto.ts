import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanCategory, LoanStatus, LoanType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';

export class CashLoanQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({
    description: 'Search loan by customer name, email or contact, or IPPIS ID',
    example: 'john doe',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: LoanStatus,
    description: 'Filter loans by current status',
    example: LoanStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @ApiPropertyOptional({
    enum: LoanCategory,
    description: 'Filter loans by category',
    example: LoanCategory.PERSONAL,
  })
  @IsOptional()
  @IsEnum(LoanCategory)
  category?: LoanCategory;

  @ApiPropertyOptional({
    enum: LoanType,
    description: 'Filter loans by type (New or Topup)',
    example: LoanType.New,
  })
  @IsOptional()
  @IsEnum(LoanType)
  type?: LoanType;

  @ApiPropertyOptional({
    description: 'Minimum principal amount',
    example: 50000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  principalMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum principal amount',
    example: 500000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  principalMax?: number;

  @ApiPropertyOptional({
    description: 'Show only loans with penalties',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  hasPenalties?: boolean;

  @ApiPropertyOptional({
    description: 'Show only loans with commodity collateral',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  hasCommodityLoan?: boolean;

  @ApiPropertyOptional({
    description: 'Filter loans disbursed after this date',
    example: '2024-06-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  disbursementStart?: Date;

  @ApiPropertyOptional({
    description: 'Filter loans disbursed before this date',
    example: '2024-06-30T23:59:59.999Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  disbursementEnd?: Date;

  @ApiPropertyOptional({
    description: 'Filter loans requested after this date',
    example: '2024-05-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  requestedStart?: Date;

  @ApiPropertyOptional({
    description: 'Filter loans requested before this date',
    example: '2024-05-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  requestedEnd?: Date;
}

export class CommodityLoanQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({
    description:
      'Search commodity loan requests by name, or the customer requesting',
    example: 'Laptop',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter commodity loans by the loan current status',
    example: {
      all: { value: undefined, summary: 'All loans' },
      inReview: { value: true, summary: 'Commodity loans still In review' },
      accepted: {
        value: false,
        summary: 'Accepted commodity loans with a corresponding cash loan',
      },
    },
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  inReview?: boolean;

  @ApiPropertyOptional({
    description: 'Filter loans requested after this date',
    example: '2024-05-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  requestedStart?: Date;

  @ApiPropertyOptional({
    description: 'Filter loans requested before this date',
    example: '2024-05-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  requestedEnd?: Date;
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

  @ApiProperty({
    description: 'Interest fee rate in percentage. UI shows current default',
    example: 6,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  interestRate: number;
}
