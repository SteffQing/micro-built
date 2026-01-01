import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanCategory, RepaymentStatus, UserStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
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
  IsNotEmpty,
  ValidateNested,
  IsDefined,
  Allow,
  MaxLength,
  IsBoolean,
  Max,
  IsDate,
} from 'class-validator';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';
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

export class CustomersQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({
    description: 'Search users by name, email, contact or external ID',
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
    description: 'Filter customers created after this date (ISO-8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  signupStart?: Date;

  @ApiPropertyOptional({
    description: 'Filter customers created before this date (ISO-8601)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  signupEnd?: Date;

  @ApiPropertyOptional({
    description: 'Minimum repayment rate (%)',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  repaymentRateMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum repayment rate (%)',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(100)
  repaymentRateMax?: number;

  @ApiPropertyOptional({
    description: 'Show only customers with active loans',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  hasActiveLoan?: boolean;

  @ApiPropertyOptional({
    description: 'Minimum employee gross pay',
    example: 50000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  grossPayMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum employee gross pay',
    example: 250000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  grossPayMax?: number;

  @ApiPropertyOptional({
    description: 'Minimum net pay',
    example: 30000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  netPayMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum net pay',
    example: 150000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  netPayMax?: number;

  @ApiPropertyOptional({
    description: 'Filter customers by account officer ID',
    example: 'usr_12345',
  })
  @IsOptional()
  @IsString()
  accountOfficerId?: string;

  @ApiPropertyOptional({
    description: 'Filter customers belonging to an organization',
    example: 'Nigerian Navy',
  })
  @IsOptional()
  @IsString()
  organization?: string;
}

class CustomerUser {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }: { value: string | undefined }) => value?.toLowerCase())
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
}

export class CustomerLoanRequest {
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
  @Allow()
  cashLoan?: CustomerCashLoan;

  @ApiPropertyOptional({
    type: () => CustomerCommodityLoan,
  })
  @Allow()
  commodityLoan?: CustomerCommodityLoan;
}

export class OnboardCustomer {
  @ApiProperty({ type: () => CreatePayrollDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreatePayrollDto)
  payroll: CreatePayrollDto;

  @ApiProperty({ type: () => CreateIdentityDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateIdentityDto)
  identity: CreateIdentityDto;

  @ApiProperty({ type: () => CreatePaymentMethodDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreatePaymentMethodDto)
  paymentMethod: CreatePaymentMethodDto;

  @ApiProperty({ type: () => CustomerUser })
  @IsDefined()
  @ValidateNested()
  @Type(() => CustomerUser)
  user: CustomerUser;

  @ApiPropertyOptional({ type: () => CustomerLoanRequest })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerLoanRequest)
  loan?: CustomerLoanRequest;
}

export class UpdateCustomerStatusDto {
  @ApiProperty({
    description: 'New status of the customer',
    enum: UserStatus,
    example: UserStatus.FLAGGED,
  })
  @IsEnum(UserStatus, {
    message: 'status must be ACTIVE, INACTIVE, or FLAGGED',
  })
  status: UserStatus;

  @ApiPropertyOptional({
    description: 'Tells the reason why this user is getting flagged',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SendMessageDto {
  @ApiProperty({
    description: 'Title of the message',
    example: 'Account Deactivated',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiProperty({
    description: 'Body of the message',
    example: 'Your account has been deactivated due to suspicious activity.',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;
}

export class CreateLiquidationRequestDto {
  @ApiProperty({
    description: 'Amount to liquidate',
    example: 5000,
  })
  @IsNumber()
  @IsPositive({ message: 'Amount must be a positive number' })
  amount: number;
}

export class GenerateCustomerLoanReportDto {
  @ApiProperty({
    description: 'Email to receive the report to',
    example: 'user@example.com',
  })
  @IsEmail()
  @Transform(({ value }: { value: string | null | undefined }) =>
    typeof value === 'string' ? value.toLowerCase() : undefined,
  )
  email: string;
}
