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

export class CustomersOrganizationsDto {
  @ApiProperty({
    example: ['NPF', 'FRSC'],
    description: 'List of organizations in platform',
  })
  organization: string[];
}
