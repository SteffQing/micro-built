import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import {
  Gender,
  LoanCategory,
  MaritalStatus,
  MicroLoanStatus,
  PaymentInflowSource,
  PaymentInflowState,
  Relationship,
  TenureChangeStatus,
  UserStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsDateString,
  IsDefined,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  NotEquals,
  ValidateNested,
} from 'class-validator';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';
import { IsMoney } from 'src/common/dto/money.dto';
import { PeriodRangeQueryDto } from 'src/common/dto/period.dto';
import { MAX_TENURE_MONTHS } from './loan.dto';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

const toLowerCase = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class CustomersQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({
    description: 'Search by name, email, phone number, customer id or IPPIS number',
    example: 'jane@example.com',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: UserStatus, description: 'Filter customers by account status', example: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Signed up on or after this day (Lagos calendar)', example: '2026-01-01' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  signupStart?: Date;

  @ApiPropertyOptional({ description: 'Signed up on or before this day (Lagos calendar)', example: '2026-12-31' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  signupEnd?: Date;

  @ApiPropertyOptional({ description: 'Minimum repayment rate (percent, 0–100)', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  repaymentRateMin?: number;

  @ApiPropertyOptional({ description: 'Maximum repayment rate (percent, 0–100)', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  repaymentRateMax?: number;

  @ApiPropertyOptional({ description: 'Only customers with a disbursed (running) loan', example: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasActiveLoan?: boolean;

  @ApiPropertyOptional({ description: 'Minimum employee gross pay (naira)', example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  grossPayMin?: number;

  @ApiPropertyOptional({ description: 'Maximum employee gross pay (naira)', example: 250000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  grossPayMax?: number;

  @ApiPropertyOptional({ description: 'Minimum net pay (naira)', example: 30000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  netPayMin?: number;

  @ApiPropertyOptional({ description: 'Maximum net pay (naira)', example: 150000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  netPayMax?: number;

  @ApiPropertyOptional({
    description: "Account officer's admin id; `microbuilt-system-id` = customers without one (self sign-ups)",
    example: 'AD-1M8KI',
  })
  @IsOptional()
  @IsString()
  accountOfficerId?: string;

  @ApiPropertyOptional({ description: 'Organization on the payroll record (any case)', example: 'Nigerian Navy' })
  @IsOptional()
  @IsString()
  organization?: string;
}

export class CustomerRepaymentsQueryDto extends IntersectionType(PaginatedQueryDto, PeriodRangeQueryDto) {
  @ApiPropertyOptional({ enum: PaymentInflowState, description: 'Filter by what happened to the money' })
  @IsOptional()
  @IsEnum(PaymentInflowState)
  state?: PaymentInflowState;

  @ApiPropertyOptional({ enum: PaymentInflowSource, description: 'PAYROLL deductions or LIQUIDATION payments' })
  @IsOptional()
  @IsEnum(PaymentInflowSource)
  source?: PaymentInflowSource;
}

export class CustomerTopupHistoryQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({ description: 'Search by top-up id, loan id or asset name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: MicroLoanStatus,
    description: 'Filter by status (an asset top-up request still in review counts as PENDING)',
  })
  @IsOptional()
  @IsEnum(MicroLoanStatus)
  status?: MicroLoanStatus;
}

export class CustomerTenureChangeQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({ enum: TenureChangeStatus })
  @IsOptional()
  @IsEnum(TenureChangeStatus)
  status?: TenureChangeStatus;
}

/** `from`/`to` default to the first disbursement month and the current month (Lagos). */
export class CustomerLoanStatementQueryDto extends IntersectionType(PaginatedQueryDto, PeriodRangeQueryDto) {}

export class CustomerLiquidationQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({
    enum: PaymentInflowState,
    description: 'AWAITING (waiting for a decision), SETTLED (approved) or REJECTED',
  })
  @IsOptional()
  @IsEnum(PaymentInflowState)
  state?: PaymentInflowState;
}

// --- Onboarding -------------------------------------------------------------------------------

export class OnboardCustomerUser {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'Email or phone number (or both) is required' })
  @IsOptional()
  @Transform(toLowerCase)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '08123456789',
    description: 'Nigerian mobile number (080…, 234… or +234…), stored as +234…; marked verified (taken in person)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phoneNumber?: string;
}

export class OnboardIdentityDto {
  @ApiProperty({ description: 'Date of birth', example: '1990-01-01' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ example: '123 Main Street, Lagos' })
  @IsString()
  @IsNotEmpty()
  residencyAddress: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  stateResidency: string;

  @ApiProperty({ example: 'Adjacent Crescent Moon Printing House, VI Lagos' })
  @IsString()
  @IsNotEmpty()
  landmarkOrBusStop: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  nextOfKinName: string;

  @ApiProperty({ example: '08012345678' })
  @IsString()
  @IsNotEmpty()
  nextOfKinContact: string;

  @ApiProperty({ example: 'Iperu-Remo, Ogun state' })
  @IsString()
  @IsNotEmpty()
  nextOfKinAddress: string;

  @ApiProperty({ enum: Relationship, example: Relationship.Sibling })
  @IsEnum(Relationship)
  nextOfKinRelationship: Relationship;

  @ApiProperty({ enum: Gender, example: Gender.Male })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ enum: MaritalStatus, example: MaritalStatus.Married })
  @IsEnum(MaritalStatus)
  maritalStatus: MaritalStatus;
}

export class OnboardPaymentMethodDto {
  @ApiProperty({ example: 'Access Bank' })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({ example: '0123456789', description: '10 digits' })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'Account number must be 10 digits' })
  accountNumber: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  accountName: string;

  @ApiProperty({ example: '01234567890', description: '11 digits' })
  @IsString()
  @Matches(/^\d{11}$/, { message: 'BVN must be 11 digits' })
  bvn: string;
}

export class OnboardPayrollDto {
  @ApiProperty({ description: 'IPPIS number: matches the payroll sheet (Customer.externalId)', example: 'PF12033' })
  @IsString()
  @IsNotEmpty()
  externalId: string;

  @ApiPropertyOptional({ example: 'Level 12' })
  @IsOptional()
  @IsString()
  grade?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  step?: number;

  @ApiProperty({ example: 'Lagos Command' })
  @IsString()
  @IsNotEmpty()
  command: string;

  @ApiProperty({ example: 'NPF' })
  @IsString()
  @IsNotEmpty()
  organization: string;
}

export class CustomerCashLoan {
  @IsMoney({ example: 100000, description: 'Amount (naira)' })
  amount: number;

  @ApiPropertyOptional({
    description: 'Months to repay: required when onboarding; not allowed on a top-up (send monthsDelta)',
    example: 6,
    minimum: 1,
    maximum: MAX_TENURE_MONTHS,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_TENURE_MONTHS)
  tenure?: number;
}

export class CustomerCommodityLoan {
  @ApiProperty({ example: 'Laptop', description: 'An active commodity (GET /admin/commodities)' })
  @IsString()
  @IsNotEmpty()
  assetName: string;
}

export class CustomerLoanRequest {
  @ApiProperty({
    enum: LoanCategory,
    example: LoanCategory.PERSONAL,
    description: 'ASSET_PURCHASE = an asset (commodityLoan); any other category = cash (cashLoan)',
  })
  @IsEnum(LoanCategory)
  category: LoanCategory;

  @ApiPropertyOptional({ type: () => CustomerCashLoan })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerCashLoan)
  cashLoan?: CustomerCashLoan;

  @ApiPropertyOptional({ type: () => CustomerCommodityLoan })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerCommodityLoan)
  commodityLoan?: CustomerCommodityLoan;
}

/** POST /admin/customer/:id/loan-topup */
export class CustomerLoanTopupDto extends CustomerLoanRequest {
  @ApiPropertyOptional({
    description:
      "Cash top-ups only: months to add to (or, negative, remove from) the loan's tenure, decided with the top-up",
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @NotEquals(0, { message: 'monthsDelta must not be 0' })
  @Min(-MAX_TENURE_MONTHS)
  @Max(MAX_TENURE_MONTHS)
  monthsDelta?: number;
}

export class OnboardCustomer {
  @ApiProperty({ type: () => OnboardPayrollDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => OnboardPayrollDto)
  payroll: OnboardPayrollDto;

  @ApiProperty({ type: () => OnboardIdentityDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => OnboardIdentityDto)
  identity: OnboardIdentityDto;

  @ApiProperty({ type: () => OnboardPaymentMethodDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => OnboardPaymentMethodDto)
  paymentMethod: OnboardPaymentMethodDto;

  @ApiProperty({ type: () => OnboardCustomerUser })
  @IsDefined()
  @ValidateNested()
  @Type(() => OnboardCustomerUser)
  user: OnboardCustomerUser;

  @ApiPropertyOptional({
    type: () => CustomerLoanRequest,
    description: 'A first loan: cash is approved at once (awaiting disbursement); an asset goes to review',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerLoanRequest)
  loan?: CustomerLoanRequest;
}

// --- Customer page actions -----------------------------------------------------------------------

export class UpdateCustomerStatusDto {
  @ApiProperty({ description: 'New status of the customer', enum: UserStatus, example: UserStatus.FLAGGED })
  @IsEnum(UserStatus, { message: 'status must be ACTIVE, INACTIVE, or FLAGGED' })
  status: UserStatus;

  @ApiPropertyOptional({
    description: 'Why: required to flag (shown as the flag reason), optional otherwise; kept in the audit log',
    example: 'Payroll record does not match the ID card',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SendMessageDto {
  @ApiProperty({ description: 'Title of the message', example: 'Account Deactivated', maxLength: 100 })
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

export class GenerateCustomerLoanReportDto extends PeriodRangeQueryDto {
  @ApiPropertyOptional({
    description: "Where to send the report; defaults to the requesting admin's email",
    example: 'user@example.com',
  })
  @IsOptional()
  @Transform(toLowerCase)
  @IsEmail()
  email?: string;
}
