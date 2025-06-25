import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { LoanCategory, LoanStatus, LoanType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateLoanDto {
  @ApiProperty({
    example: 100000,
    description: 'Amount being requested for the loan',
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: LoanType,
    example: LoanType.CASH,
    description: 'Type of loan being applied for',
  })
  @IsEnum(LoanType)
  loanType: LoanType;

  @ApiProperty({
    enum: LoanCategory,
    example: LoanCategory.PERSONAL,
    description: 'Loan category classification',
  })
  @IsEnum(LoanCategory)
  category: LoanCategory;

  @ApiProperty({ example: 6, description: 'Loan tenure in months' })
  @IsNumber()
  @Min(1)
  loanTenure: number;

  @ApiPropertyOptional({
    example: 'clx5nklc1000elafxtgyq5ehd',
    description: 'Asset ID, required for asset-based loans',
    required: false,
  })
  @IsOptional()
  @IsString()
  assetId?: string;
}

export class UpdateLoanDto extends PartialType(CreateLoanDto) {
  @ApiProperty({
    example: 'LN-OE93ND',
    description: 'Loan ID, required for loan update',
  })
  @IsString()
  id: string;
}

export class DeleteLoanDto {
  @ApiProperty({
    example: 'LN-OE93ND',
    description: 'Loan ID, required for loan deletion',
  })
  @IsString()
  id: string;
}

export class LoanDataDto {
  @ApiProperty({ example: 'LN-123456' })
  id: string;

  @ApiProperty({ example: 150000 })
  amount: number;

  @ApiProperty({ example: 162000 })
  repayable: number;

  @ApiProperty({ enum: LoanStatus, example: 'PENDING' })
  status: LoanStatus;

  @ApiProperty({ enum: LoanType, example: 'CASH' })
  loanType: LoanType;

  @ApiProperty({ enum: LoanCategory, example: 'PERSONAL' })
  category: LoanCategory;

  @ApiProperty({ example: 6, description: 'Loan tenure in months' })
  loanTenure: number;

  @ApiProperty({ example: 1, description: 'Extension duration in months' })
  extension: number;

  @ApiPropertyOptional({
    example: '2025-08-01T00:00:00.000Z',
    required: false,
    description: 'Date loan was disbursed',
  })
  disbursementDate?: Date;

  @ApiPropertyOptional({
    example: 'INV-94MFR0',
    required: false,
    description: 'ID of asset attached to this loan request',
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
