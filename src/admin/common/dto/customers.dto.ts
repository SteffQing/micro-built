import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { MetaDto } from 'src/common/dto';

export class CustomersQueryDto {
  @ApiPropertyOptional({
    description: 'Search users by name or email address',
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
    example: 1,
    default: 1,
    description: 'Page number for pagination (starts from 1)',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Number of items to return per page',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  limit?: number = 20;
}

class CustomerListItemDto {
  @ApiProperty({ description: 'Unique identifier of the user' })
  id: string;

  @ApiProperty({ description: 'Full name of the customer' })
  name: string;

  @ApiProperty({ description: 'Email address of the customer' })
  email: string;

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

@ApiExtraModels(CustomerListItemDto)
export class CustomersResponseDto {
  @ApiProperty({ type: MetaDto, description: 'Pagination metadata' })
  meta: MetaDto;

  @ApiProperty({
    type: [CustomerListItemDto],
    description: 'List of matching customer records',
  })
  data: CustomerListItemDto[];

  @ApiProperty({
    example: 'Customers table has been successfully queried',
    description: 'Operation message',
  })
  message: string;
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
