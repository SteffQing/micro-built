import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { LoanCategory, LoanStatus } from '@prisma/client';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';
import { IsMoney } from 'src/common/dto/money.dto';

/** Every category but ASSET_PURCHASE, which only an asset request (POST /user/loan/commodity) opens. */
export const CASH_LOAN_CATEGORIES = Object.values(LoanCategory).filter(
  (category) => category !== LoanCategory.ASSET_PURCHASE,
);

const CATEGORY_MESSAGE = `category must be one of: ${CASH_LOAN_CATEGORIES.join(', ')}`;

export class CreateLoanDto {
  @IsMoney({
    example: 100000,
    description: 'Amount requested. When the customer already has a disbursed loan this is the top-up amount.',
  })
  amount: number;

  @ApiPropertyOptional({
    enum: CASH_LOAN_CATEGORIES,
    example: LoanCategory.PERSONAL,
    description: 'Required for a new loan; ignored for a top-up',
  })
  @IsOptional()
  @IsIn(CASH_LOAN_CATEGORIES, { message: CATEGORY_MESSAGE })
  category?: LoanCategory;
}

export class UpdateLoanDto {
  @IsMoney({ optional: true, example: 120000 })
  amount?: number;

  @ApiPropertyOptional({ enum: CASH_LOAN_CATEGORIES, example: LoanCategory.EDUCATION })
  @IsOptional()
  @IsIn(CASH_LOAN_CATEGORIES, { message: CATEGORY_MESSAGE })
  category?: LoanCategory;
}

export class UserCommodityLoanRequestDto {
  @ApiProperty({ example: 'Laptop', description: 'Name of an available commodity (any letter case)' })
  @IsString()
  @IsNotEmpty({ message: 'Choose a commodity' })
  @MaxLength(100)
  assetName: string;
}

export class LoanHistoryRequestDto extends PaginatedQueryDto {
  @ApiPropertyOptional({ enum: LoanStatus, example: LoanStatus.DISBURSED, description: 'Only loans in this status' })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;
}
