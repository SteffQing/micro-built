import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

export class AdminListDto {
  @ApiProperty({
    example: 'abc123',
    description: 'Unique identifier of the admin user',
  })
  id: string;

  @ApiProperty({
    example: 'https://example.com/avatar.png',
    description: "URL of the admin user's avatar",
    nullable: true,
  })
  avatar: string | null;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Full name of the admin user',
  })
  name: string;

  @ApiProperty({ enum: UserRole, description: 'Role of the admin user' })
  role: UserRole;

  @ApiProperty({
    example: 'jane@example.com',
    description: 'Email address of the admin user',
  })
  email: string;

  @ApiProperty({
    enum: UserStatus,
    description: 'Account status of the admin user',
  })
  status: UserStatus;
}

export class AccountOfficerDto {
  @ApiProperty({
    example: 'abc123',
    description: 'Unique identifier of the account officer',
  })
  id: string;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Full name of the account officer',
  })
  name: string;

  @ApiProperty({
    enum: UserRole,
    description: 'Role of the account officer. SYSTEM is also supported here',
  })
  role: UserRole;

  @ApiProperty({
    description: 'Number of customers signed up under this account officer',
  })
  customersCount: number;

  @ApiProperty({
    description: 'Indicates if this account officer, is actually the system',
  })
  isSystem: boolean;
}

class AccountOfficerCustomersDto {
  @ApiProperty({
    example: 120,
    description: 'Total number of customers managed by the account officer',
  })
  total: number;

  @ApiProperty({
    example: 95,
    description: 'Number of active customers',
  })
  active: number;

  @ApiProperty({
    example: 20,
    description: 'Number of inactive customers',
  })
  inactive: number;

  @ApiProperty({
    example: 5,
    description: 'Number of customers flagged for risk or compliance issues',
  })
  flagged: number;

  @ApiProperty({
    example: 82.5,
    description:
      'Average repayment score across all customers, indicating repayment reliability',
  })
  avgRepaymentScore: number;
}

class AccountOfficerPortfolioDto {
  @ApiProperty({
    example: 50,
    description: 'Total number of loans issued under this account officer',
  })
  totalLoans: number;

  @ApiProperty({
    example: 250000,
    description:
      'Total amount disbursed across all loans (in local currency units)',
  })
  totalDisbursed: number;

  @ApiProperty({
    example: 200000,
    description: 'Total amount successfully repaid by customers',
  })
  totalRepaid: number;

  @ApiProperty({
    example: 5000,
    description: 'Total penalties accrued due to late repayments',
  })
  totalPenalty: number;

  @ApiProperty({
    example: 45000,
    description: 'Outstanding balance yet to be repaid by customers',
  })
  outstandingBalance: number;
}

export class AccountOfficerStatDto {
  @ApiProperty({
    description: 'Detailed customer statistics for this account officer',
    type: AccountOfficerCustomersDto,
  })
  customers: AccountOfficerCustomersDto;

  @ApiProperty({
    description: 'Portfolio statistics including loans and repayments',
    type: AccountOfficerPortfolioDto,
  })
  portfolio: AccountOfficerPortfolioDto;
}
