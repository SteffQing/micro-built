import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  AdminRole,
  LoanCategory,
  LoanStatus,
  PaymentInflowSource,
  UserStatus,
  UserType,
} from '@prisma/client';
import { LoanFiguresDto } from 'src/common/dto/loan.dto';
import { CreateIdentityDto } from '../dto/identity.dto';
import { CreatePayrollDto } from '../dto/payroll.dto';
import { ACTIVITY_SOURCES } from '../interface/activity';

const ROLES = ['CUSTOMER', ...Object.values(AdminRole)];

export class UserPaymentMethodDto {
  @ApiProperty({ description: 'Bank name of the user', example: 'Access Bank' })
  bankName: string;

  @ApiProperty({ description: '10-digit bank account number', example: '0123456789' })
  accountNumber: string;

  @ApiProperty({ description: 'Full name on the bank account', example: 'John Doe' })
  accountName: string;
}

export class UserAccountOfficerDto {
  @ApiProperty({ example: 'AD-Q81LM' })
  id: string;

  @ApiProperty({ example: 'Ada Obi' })
  name: string;
}

export class UserDto {
  @ApiProperty({ description: 'MB-… for customers, AD-… for admins', example: 'MB-Z891W' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({
    description: 'null for phone-only customers (their account carries a placeholder address)',
    example: 'user@example.com',
    nullable: true,
    type: String,
  })
  email: string | null;

  @ApiProperty({ example: '+2348012345678', nullable: true, type: String })
  phoneNumber: string | null;

  @ApiProperty({
    description: 'Public avatar URL',
    example: 'https://xyz.supabase.co/storage/v1/object/public/avatars/MB-Z891W',
    nullable: true,
    type: String,
  })
  image: string | null;

  @ApiProperty({ description: 'CUSTOMER, or the admin’s role', enum: ROLES, example: 'CUSTOMER' })
  role: string;

  @ApiProperty({ enum: UserType, example: UserType.CUSTOMER })
  type: UserType;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ example: false })
  twoFactorEnabled: boolean;

  @ApiProperty({
    description: 'IPPIS number (customers only)',
    example: 'PF12033',
    nullable: true,
    type: String,
  })
  externalId: string | null;

  @ApiProperty({
    description: 'Why the account is waiting for review (customers only)',
    example: 'User added payroll information. Needs review by admin to confirm correctness of information',
    nullable: true,
    type: String,
  })
  flagReason: string | null;

  @ApiProperty({ type: UserAccountOfficerDto, nullable: true, description: 'Customers only' })
  accountOfficer: UserAccountOfficerDto | null;

  @ApiProperty({ example: '2026-01-04T09:12:00.000Z' })
  createdAt: Date;
}

export class UserAvatarDto {
  @ApiProperty({ example: 'https://xyz.supabase.co/storage/v1/object/public/avatars/MB-Z891W' })
  url: string;
}

export class UserRecentActivityDto {
  @ApiProperty({ example: 'Repayment received' })
  title: string;

  @ApiProperty({ example: '₦25,000 was deducted from your JUNE 2026 salary.' })
  description: string;

  @ApiProperty({ example: '2026-06-28T10:00:00.000Z', format: 'date-time' })
  date: Date;

  @ApiProperty({ enum: ACTIVITY_SOURCES, example: 'Repayment', description: 'What the activity is about' })
  source: string;
}

export class UserOverviewLoanDto extends LoanFiguresDto {
  @ApiProperty({ example: 'LN-W03D0Q' })
  id: string;

  @ApiProperty({ enum: LoanCategory, example: LoanCategory.PERSONAL })
  category: LoanCategory;

  @ApiProperty({ enum: [LoanStatus.PENDING, LoanStatus.APPROVED, LoanStatus.DISBURSED], example: LoanStatus.DISBURSED })
  status: LoanStatus;

  @ApiProperty({ nullable: true, type: Date, example: '2026-03-02T10:00:00.000Z' })
  disbursementDate: Date | null;

  @ApiProperty({ example: '2026-02-20T10:00:00.000Z' })
  createdAt: Date;
}

export class UserPendingRequestsDto {
  @ApiProperty({ example: 0, description: 'Loan requests waiting for approval or disbursement' })
  loans: number;

  @ApiProperty({ example: 1, description: 'Top-ups waiting for approval or disbursement' })
  topups: number;

  @ApiProperty({ example: 0, description: 'Asset requests in review' })
  commodities: number;
}

export class UserLastDeductionDto {
  @ApiProperty({ example: 22500 })
  amount: number;

  @ApiProperty({ example: '2026-06-28T10:00:00.000Z' })
  date: Date;

  @ApiProperty({ example: 'JUNE 2026', description: 'Payroll month the payment belongs to' })
  period: string;

  @ApiProperty({ enum: PaymentInflowSource, example: PaymentInflowSource.PAYROLL })
  source: PaymentInflowSource;
}

export class UserNextDeductionDto {
  @ApiProperty({ example: 22500, description: 'What payroll will be asked for (OPEN deduction)' })
  amount: number;

  @ApiProperty({ example: 'JULY 2026' })
  period: string;
}

export class UserOverviewDto {
  @ApiProperty({
    type: UserOverviewLoanDto,
    nullable: true,
    description: 'The customer’s live loan (PENDING, APPROVED or DISBURSED; there is at most one)',
  })
  currentLoan: UserOverviewLoanDto | null;

  @ApiProperty({ example: 100, description: 'Share of closed-month deductions collected, 0–100' })
  repaymentRate: number;

  @ApiProperty({ example: 1, description: 'Sum of pendingRequests' })
  pendingLoanRequestsCount: number;

  @ApiProperty({ type: UserPendingRequestsDto })
  pendingRequests: UserPendingRequestsDto;

  @ApiProperty({ type: UserLastDeductionDto, nullable: true, description: 'The latest repayment' })
  lastDeduction: UserLastDeductionDto | null;

  @ApiProperty({ type: UserNextDeductionDto, nullable: true })
  nextDeduction: UserNextDeductionDto | null;
}

export class UserPayrollDto extends OmitType(CreatePayrollDto, ['externalId'] as const) {
  @ApiProperty({ description: 'IPPIS number (Customer.externalId)', example: 'PF12033' })
  externalId: string;

  @ApiProperty({ example: 185000, description: 'From the latest payroll return (0 until one arrives)' })
  netPay: number;

  @ApiProperty({ example: 240000 })
  employeeGross: number;
}

export class UserIdentityDto extends CreateIdentityDto {}

export class UserNotificationDto {
  @ApiProperty({ example: 'cm1x2y3z40000abcd' })
  id: string;

  @ApiProperty({ example: 'Loan disbursed' })
  title: string;

  @ApiProperty({ example: 'Your loan of ₦100,000 has been disbursed.' })
  description: string;

  @ApiPropertyOptional({ nullable: true, type: String, example: '/dashboard/loans' })
  callToActionUrl: string | null;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiProperty({ nullable: true, type: Date, example: null })
  readAt: Date | null;

  @ApiProperty({ example: '2026-06-28T10:00:00.000Z' })
  createdAt: Date;
}

export class UserNotificationsDto {
  @ApiProperty({ type: [UserNotificationDto] })
  notifications: UserNotificationDto[];

  @ApiProperty({ example: 3 })
  unreadCount: number;
}
