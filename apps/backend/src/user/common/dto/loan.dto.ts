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
  Max,
} from 'class-validator';
import { MAX_PAGE_LIMIT } from 'src/common/dto/generic.dto';

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
    maximum: MAX_PAGE_LIMIT,
    description: `Number of items to return per page (max ${MAX_PAGE_LIMIT})`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(MAX_PAGE_LIMIT)
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
