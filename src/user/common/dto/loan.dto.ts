import { ApiProperty, PartialType } from '@nestjs/swagger';
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
    enum: [LoanStatus.APPROVED, LoanStatus.REJECTED],
    example: LoanStatus.APPROVED,
  })
  @IsIn([LoanStatus.APPROVED, LoanStatus.REJECTED])
  status: LoanStatus;
}

export class UserCommodityLoanRequestDto {
  @ApiProperty({
    example: 'Laptop',
    description: 'name of asset for this loan request',
  })
  assetName: string;
}

export class LoanHistoryRequestDto {
  @ApiProperty({ example: 2 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}
