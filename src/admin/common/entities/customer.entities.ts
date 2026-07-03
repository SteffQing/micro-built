import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { LoanCategory, UserStatus } from '@prisma/client';
import {
  UserPayrollDto,
  UserIdentityDto,
  UserPaymentMethodDto,
} from 'src/user/common/entities';

export class CustomerUserId {
  @ApiProperty({ description: 'Unique user ID', example: 'MB-E0320S' })
  userId: string;
}

export class CustomerInfoDto {
  @ApiProperty({ description: 'Unique user ID', example: 'MB-E0320S' })
  id: string;

  @ApiProperty({ description: 'Full name of the user', example: 'John Doe' })
  name: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'user@example.com',
    nullable: true,
  })
  email: string | null;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({
    nullable: true,
    example: '07012345678',
    description: 'Contact phone number',
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

class DisbursedLoanDto {
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

@ApiExtraModels(DisbursedLoanDto, PendingLoanDto)
export class UserLoansDto {
  @ApiProperty({ type: [DisbursedLoanDto] })
  activeLoans: DisbursedLoanDto[];

  @ApiProperty({ type: [PendingLoanDto] })
  pendingLoans: PendingLoanDto[];
}

export class UserLoanSummaryDto {
  @ApiProperty({
    example: 100000,
    description: 'Total principal the customer has borrowed (Σ principal)',
  })
  totalBorrowed: number;

  @ApiProperty({
    example: 7000,
    description:
      'Balance on active loans that is still owed, including penalties',
  })
  currentOverdue: number;

  @ApiProperty({
    example: 5000,
    description: 'Total penalty charges levied on the customer (accrual)',
  })
  totalPenalties: number;

  @ApiProperty({
    example: 30000,
    description: 'Gross total of loan balance repaid by customer',
  })
  totalRepaid: number;

  @ApiProperty({
    example: 120000,
    description:
      'Total loan turnover: disbursed + management fee + interest (Σ repayable)',
  })
  totalLoanAmount: number;

  @ApiProperty({
    example: 97000,
    description: 'Amount actually paid out (principal minus management fee)',
  })
  totalDisbursed: number;

  @ApiProperty({
    example: 3000,
    description: 'Management fees booked upfront on the customer’s loans',
  })
  managementFee: number;

  @ApiProperty({
    example: 20000,
    description: 'Interest booked on the customer’s loans, collected or not',
  })
  interestEarned: number;

  @ApiProperty({
    example: 12000,
    description: 'Interest actually collected from the customer’s repayments',
  })
  interestReceived: number;

  @ApiProperty({
    example: 2000,
    description: 'Penalty charges actually collected',
  })
  penaltiesReceived: number;

  @ApiProperty({
    example: 90000,
    description:
      'Outstanding balance: total loan amount minus total repaid (excludes penalties)',
  })
  outstanding: number;

  @ApiProperty({ example: 2, description: 'Number of active (disbursed) loans' })
  activeLoansCount: number;

  @ApiProperty({ example: 1, description: 'Number of pending loan requests' })
  pendingLoansCount: number;

  @ApiProperty({
    example: '2026-06-01T00:00:00.000Z',
    nullable: true,
    description: 'Period date of the customer’s most recent received repayment',
  })
  lastRepaymentDate: Date | null;

  @ApiProperty({
    example: 'JUNE 2026',
    nullable: true,
    description: 'Period label of the customer’s most recent received repayment',
  })
  lastRepaymentPeriod: string | null;
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
