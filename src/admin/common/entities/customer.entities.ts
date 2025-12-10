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
    description: 'Total amount customer has borrowed',
  })
  totalBorrowed: number;

  @ApiProperty({
    example: 40000,
    description: 'Total amount user has repaid in interests',
  })
  interestPaid: number;

  @ApiProperty({
    example: 7000,
    description:
      'Balance in the active loan that is overdue for payment, includes penalty up to that point',
  })
  currentOverdue: number;

  @ApiProperty({
    example: 30000,
    description: 'Gross total of loan balance repaid by customer',
  })
  totalRepaid: number;
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
