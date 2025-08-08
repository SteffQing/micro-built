import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanCategory, RepaymentStatus, UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsPositive,
  IsInt,
  IsString,
  IsPhoneNumber,
  IsEmail,
  IsNumber,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import {
  CreateIdentityDto,
  CreatePaymentMethodDto,
  CreatePayrollDto,
} from 'src/user/common/dto';

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
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Number of items to return per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number = 20;
}

export class CustomersQueryDto {
  @ApiPropertyOptional({
    description: 'Search users by name or email address',
    example: 'jane@example.com',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Filter customers by account status',
    example: UserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Page number for pagination (starts from 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Number of items to return per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number = 20;
}

class CustomerUser {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '08123456789' })
  @IsOptional()
  @IsPhoneNumber('NG')
  contact?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;
}

export class CustomerCashLoan {
  @ApiProperty({
    example: 100000,
    description: 'Amount being requested for the loan',
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Loan tenure in months',
    example: 6,
  })
  @IsInt()
  @Min(1)
  tenure: number;
}

export class CustomerCommodityLoan {
  @ApiProperty({
    example: 'Laptop',
    description: 'name of asset for this loan request',
  })
  @IsString()
  assetName: string;

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

class CustomerLoan {
  @ApiProperty({
    enum: LoanCategory,
    example: LoanCategory.PERSONAL,
    description: 'Loan category classification',
  })
  @IsEnum(LoanCategory)
  category: LoanCategory;

  @ApiPropertyOptional({
    type: () => CustomerCashLoan,
  })
  cashLoan?: CustomerCashLoan;

  @ApiPropertyOptional({
    type: () => CustomerCommodityLoan,
  })
  commodityLoan?: CustomerCommodityLoan;
}

export class OnboardCustomer {
  @ApiProperty({
    type: () => CreatePayrollDto,
  })
  payroll: CreatePayrollDto;

  @ApiProperty({
    type: () => CreateIdentityDto,
  })
  identity: CreateIdentityDto;

  @ApiProperty({
    type: () => CreatePaymentMethodDto,
  })
  paymentMethod: CreatePaymentMethodDto;

  @ApiProperty({
    type: () => CustomerUser,
  })
  user: CustomerUser;

  @ApiPropertyOptional({
    type: () => CustomerLoan,
  })
  loan?: CustomerLoan;
}
