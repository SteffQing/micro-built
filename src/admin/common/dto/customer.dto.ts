import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { LoanCategory, RepaymentStatus, UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsPositive, IsNumber } from 'class-validator';
import { ResponseDto } from 'src/common/dto';

class CustomerInfoDto {
  @ApiProperty({ description: 'Unique user ID' })
  id: string;

  @ApiProperty({ description: 'Full name of the user' })
  name: string;

  @ApiProperty({ description: 'Email address of the user' })
  email: string;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({
    nullable: true,
    example: '07012345678',
    description: 'Contact phone number (from KYC)',
  })
  contact: string | null;

  @ApiProperty({
    nullable: true,
    description: 'URL of the user avatar or null if not set',
  })
  avatar: string | null;
}

@ApiExtraModels(CustomerInfoDto)
export class CustomerInfoResponseDto extends ResponseDto<CustomerInfoDto> {
  @ApiProperty({ example: 'Customer details retrieved successfully' })
  declare message: string;
}

class ActiveLoanDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 50000, description: 'Amount disbursed to the user' })
  amount: number;

  @ApiProperty({
    example: 12,
    description: 'Loan duration in months',
  })
  loanTenure: number;

  @ApiProperty({ example: 10000, description: 'Total amount repaid so far' })
  amountRepaid: number;

  @ApiProperty({
    example: 40000,
    description: 'Remaining loan balance (repayable - repaid)',
  })
  balance: number;
}

class PendingLoanDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    enum: LoanCategory,
    example: LoanCategory.EDUCATION,
    description: 'Loan category requested',
  })
  category: LoanCategory;

  @ApiProperty({
    example: 20000,
    description: 'Requested amount awaiting approval',
  })
  amount: number;

  @ApiProperty({ type: Date, description: 'Date loan was requested' })
  date: Date;
}

@ApiExtraModels(ActiveLoanDto, PendingLoanDto)
class UserLoansDto {
  @ApiProperty({ type: [ActiveLoanDto] })
  activeLoans: ActiveLoanDto[];

  @ApiProperty({ type: [PendingLoanDto] })
  pendingLoans: PendingLoanDto[];
}

export class UserLoansResponseDto extends ResponseDto<UserLoansDto> {
  @ApiProperty({
    example: "User's active and pending loans have been successfully queried",
  })
  declare message: string;
}

export class UserLoanSummaryDto {
  @ApiProperty({
    example: 100000,
    description: 'Total borrowed amount from all loans',
  })
  totalBorrowed: number;

  @ApiProperty({
    example: 40000,
    description: 'Remaining outstanding amount',
  })
  totalOutstanding: number;

  @ApiProperty({
    example: 3,
    description:
      'Number of times this user defaulted on repayments (FAILED or AWAITING)',
  })
  defaultedRepaymentsCount: number;

  @ApiProperty({
    example: 1,
    description:
      'Number of times this user had flagged repayments (PARTIAL or OVERPAID)',
  })
  flaggedRepaymentsCount: number;
}

export class CustomerQueryDto {
  @ApiPropertyOptional({
    enum: RepaymentStatus,
    description: 'Filter customer repayments by repayment status',
    example: RepaymentStatus.FULFILLED,
  })
  @IsOptional()
  @IsEnum(RepaymentStatus)
  status?: RepaymentStatus;

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
