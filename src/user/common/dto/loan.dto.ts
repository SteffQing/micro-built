import { ApiProperty, PartialType } from '@nestjs/swagger';
import { LoanCategory, LoanStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
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
    enum: LoanCategory,
    example: LoanCategory.PERSONAL,
    description: 'Loan category classification',
  })
  @IsEnum(LoanCategory)
  category: LoanCategory;
}

export class UpdateLoanDto extends PartialType(CreateLoanDto) {}

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
  @IsString()
  assetName: string;
}

export class LoanHistoryRequestDto {
  @ApiProperty({
    example: 1,
    default: 1,
    description: 'Page number for pagination (starts from 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @ApiProperty({
    example: 10,
    default: 10,
    description: 'Number of items to return per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number = 10;

  @ApiProperty({
    example: LoanStatus.APPROVED,
    description: 'query loan history by status',
    enum: LoanStatus,
  })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;
}
