import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { LoanCategory, UserStatus } from '@prisma/client';
import {
  UserPayrollDto,
  UserIdentityDto,
  UserPaymentMethodDto,
} from 'src/user/common/entities';

export class CustomerInfoDto {
  @ApiProperty({ description: 'Unique user ID', example: 'MB-E0320S' })
  id: string;

  @ApiProperty({ description: 'Full name of the user', example: 'John Doe' })
  name: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'user@example.com',
  })
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
    example: null,
  })
  avatar: string | null;

  @ApiProperty({
    description: "User's repayment rate/score",
  })
  repaymentRate: number;
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
export class UserLoansDto {
  @ApiProperty({ type: [ActiveLoanDto] })
  activeLoans: ActiveLoanDto[];

  @ApiProperty({ type: [PendingLoanDto] })
  pendingLoans: PendingLoanDto[];
}

export class UserLoanSummaryDto {
  @ApiProperty({
    example: 100000,
    description: 'Total borrowed amount from all loans',
  })
  totalBorrowed: number;

  @ApiProperty({
    example: 40000,
    description: 'Balance in the loan that is overdue for payment',
  })
  totalOverdue: number;

  @ApiProperty({
    example: 3,
    description: 'Number of times this user defaulted on repayments (FAILED)',
  })
  defaultedRepaymentsCount: number;

  @ApiProperty({
    example: 1,
    description: 'Number of times this user had flagged repayments (PARTIAL)',
  })
  flaggedRepaymentsCount: number;
}

export class CustomerListItemDto {
  @ApiProperty({ description: 'Unique identifier of the user' })
  id: string;

  @ApiProperty({ description: 'Full name of the customer' })
  name: string;

  @ApiPropertyOptional({ description: 'Email address of the customer' })
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number of the customer' })
  contact?: string;

  @ApiProperty({
    enum: UserStatus,
    description: 'Current status of the customer account',
    example: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @ApiProperty({
    description: 'Customer repayment rate between 0 and 1',
    example: 0.92,
  })
  repaymentRate: number;
}

export class CustomersOverviewDto {
  @ApiProperty({
    example: 200,
    description: 'Total number of customers with ACTIVE status',
  })
  activeCustomersCount: number;

  @ApiProperty({
    example: 10,
    description: 'Total number of customers flagged for attention',
  })
  flaggedCustomersCount: number;

  @ApiProperty({
    example: 80,
    description: 'Number of users currently with at least one active loan',
  })
  customersWithActiveLoansCount: number;

  @ApiProperty({
    example: 5,
    description: 'Number of customers with defaulted repayments this month',
  })
  defaultedCount: number;

  @ApiProperty({
    example: 8,
    description: 'Number of customers with flagged repayments this month',
  })
  flaggedCount: number;

  @ApiProperty({
    example: 60,
    description: 'Number of customers who fully repaid their dues this month',
  })
  ontimeCount: number;
}

export class CustomerPPIDto {
  @ApiProperty({
    type: () => UserPayrollDto,
  })
  payroll: UserPayrollDto;

  @ApiProperty({
    type: () => UserIdentityDto,
  })
  identity: UserIdentityDto;

  @ApiProperty({
    type: () => UserPaymentMethodDto,
  })
  paymentMethod: UserPaymentMethodDto;
}
