import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

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
    description:
      'Total number of customers whose account status is FLAGGED (shown as "Suspended" in the dashboard). Account status only; unrelated to repayment behaviour.',
  })
  flaggedCustomersCount: number;

  @ApiProperty({
    example: 80,
    description: 'Number of users currently with at least one active loan',
  })
  customersWithActiveLoansCount: number;

  @ApiProperty({
    example: 5,
    description:
      'Distinct customers who did not clear the latest closed repayment month in full - a FAILED or PARTIAL repayment. Takes priority over fulfilled repayments; zero if no month has been closed.',
  })
  defaultedCount: number;

  @ApiProperty({
    example: 8,
    description:
      'Subset of defaultedCount: customers whose shortfall was a PARTIAL repayment rather than a total miss. Reported for collections detail and not shown as its own dashboard card, so it must not be added to defaultedCount and ontimeCount. Separate from the FLAGGED/Suspended account status; zero if no month has been closed.',
  })
  flaggedCount: number;

  @ApiProperty({
    example: 60,
    description:
      'Distinct customers with a FULFILLED repayment and no FAILED or PARTIAL repayment in the latest closed repayment month. Awaiting and unresolved repayments are excluded; zero if no month has been closed.',
  })
  ontimeCount: number;
}

export class CustomersOrganizationsDto {
  @ApiProperty({
    example: ['NPF', 'FRSC'],
    description: 'List of organizations in platform',
  })
  organization: string[];
}
