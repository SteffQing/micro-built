import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { LoanCategory, LoanStatus } from '@prisma/client';
import { IsEnum, IsIn, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateLoanDto {
  @ApiProperty({
    example: 100000,
    description: 'Amount being requested for the loan',
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: LoanCategory,
    example: LoanCategory.PERSONAL,
    description: 'Loan category classification',
  })
  @IsEnum(LoanCategory)
  category: LoanCategory;
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

export class UpdateLoanStatusDto {
  @ApiProperty({
    enum: [LoanStatus.ACCEPTED, LoanStatus.REJECTED],
    example: LoanStatus.ACCEPTED,
  })
  @IsIn([LoanStatus.ACCEPTED, LoanStatus.REJECTED])
  status: LoanStatus;
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
    example: 'Laptop',
    required: false,
    description: 'name of asset attached to this loan request',
  })
  assetName?: string;

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

export class UserCommodityLoanRequestDto {
  @ApiProperty({
    example: 'Laptop',
    description: 'name of asset for this loan request',
  })
  assetName: string;
}
