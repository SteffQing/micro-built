import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole, UserStatus } from '@prisma/client';

export class CustomerListItemDto {
  @ApiProperty({ description: "The customer's user id", example: 'MB-HOWP2' })
  id: string;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null when the customer only has a phone number',
    example: 'jane@example.com',
  })
  email: string | null;

  @ApiProperty({ type: String, nullable: true, example: '+2348012345678' })
  phoneNumber: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'IPPIS number', example: 'PF12033' })
  externalId: string | null;

  @ApiProperty({ enum: UserStatus, description: 'Account status', example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({
    description:
      'Of what payroll was asked for in closed months, the share that came in (percent, 0–100, 2 dp); 100 when nothing has been due yet',
    example: 92.5,
  })
  repaymentRate: number;
}

export class CustomersOverviewDto {
  @ApiProperty({ example: 200, description: 'Customers whose account is ACTIVE' })
  activeCustomersCount: number;

  @ApiProperty({
    example: 10,
    description:
      'Customers whose account is FLAGGED (shown as "Suspended" in the dashboard). Account status only; unrelated to repayment behaviour.',
  })
  flaggedCustomersCount: number;

  @ApiProperty({ example: 80, description: 'Customers with a running (DISBURSED) loan' })
  customersWithActiveLoansCount: number;

  @ApiProperty({
    example: 5,
    description:
      'Customers who did not clear the latest closed payroll month in full: their worst deduction that month was FAILED or PARTIAL. Zero if no month has been closed.',
  })
  defaultedCount: number;

  @ApiProperty({
    example: 2,
    description:
      'Subset of defaultedCount whose worst deduction was PARTIAL (something came in, not enough). Not a card of its own: do not add it to defaultedCount and ontimeCount. Unrelated to the FLAGGED account status; zero if no month has been closed.',
  })
  flaggedCount: number;

  @ApiProperty({
    example: 60,
    description:
      'Customers whose every deduction in the latest closed payroll month was FULFILLED. Zero if no month has been closed.',
  })
  ontimeCount: number;
}

export class CustomerOrganizationDto {
  @ApiProperty({ description: 'The organization name (also its id)', example: 'NPF' })
  id: string;

  @ApiProperty({ example: 'NPF' })
  name: string;
}

export class AccountOfficerListItemDto {
  @ApiProperty({
    description: "The admin's user id, or `microbuilt-system-id` for customers without an officer (self sign-ups)",
    example: 'AD-1M8KI',
  })
  id: string;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({ enum: AdminRole, description: 'SYSTEM for the self sign-ups entry' })
  role: AdminRole;

  @ApiPropertyOptional({
    enum: UserStatus,
    nullable: true,
    description: "The admin's account status (INACTIVE = removed); null for the self sign-ups entry",
  })
  status: UserStatus | null;

  @ApiProperty({ description: 'Customers this officer onboarded', example: 42 })
  customersCount: number;

  @ApiProperty({ description: 'True for the self sign-ups entry' })
  isSystem: boolean;
}

export class AccountOfficerCustomerStatsDto {
  @ApiProperty({ example: 120 })
  total: number;

  @ApiProperty({ example: 95 })
  active: number;

  @ApiProperty({ example: 20 })
  inactive: number;

  @ApiProperty({ example: 5 })
  flagged: number;

  @ApiProperty({ description: "Average of the customers' repayment rates (percent, rounded)", example: 83 })
  avgRepaymentScore: number;
}

export class AccountOfficerPortfolioStatsDto {
  @ApiProperty({ description: 'Loans that were disbursed (running or repaid)', example: 50 })
  totalLoans: number;

  @ApiProperty({ description: 'Principal disbursed, top-ups included, before the management fee', example: 2500000 })
  totalDisbursed: number;

  @ApiProperty({ description: 'Collected on those loans (principal, interest and penalties)', example: 2000000 })
  totalRepaid: number;

  @ApiProperty({ description: 'Penalties charged on those loans', example: 5000 })
  totalPenalty: number;

  @ApiProperty({ description: 'Still owed on those loans', example: 450000 })
  outstandingBalance: number;
}

export class AccountOfficerStatsDto {
  @ApiProperty({ type: AccountOfficerCustomerStatsDto })
  customers: AccountOfficerCustomerStatsDto;

  @ApiProperty({ type: AccountOfficerPortfolioStatsDto })
  portfolio: AccountOfficerPortfolioStatsDto;
}

export class OnboardedCustomerDto {
  @ApiProperty({ description: "The new customer's user id", example: 'MB-HOWP2' })
  userId: string;

  @ApiProperty({ type: String, nullable: true, description: 'The first loan, when one was given', example: 'LN-8K2J4Q' })
  loanId: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'The asset request, for a first asset loan' })
  commodityLoanId: string | null;
}
