import { ApiProperty, OmitType } from '@nestjs/swagger';
import { UserStatus, UserRole } from '@prisma/client';
import { CreateIdentityDto, CreatePayrollDto } from '../dto';

export class UserPaymentMethodDto {
  @ApiProperty({
    description: 'Bank name of the user',
    example: 'Access Bank',
  })
  bankName: string;

  @ApiProperty({
    description: '10-digit bank account number',
    example: '0123456789',
  })
  accountNumber: string;

  @ApiProperty({
    description: 'Full name on the bank account',
    example: 'John Doe',
  })
  accountName: string;
}
export class UserDto {
  @ApiProperty({
    description: 'Unique identifier for the user',
    example: 'MB-Z891W',
  })
  id: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'Phone number or contact information (optional)',
    example: '08012345678',
    nullable: true,
  })
  contact: string | null;

  @ApiProperty({
    description: 'Avatar image URL or identifier (optional)',
    example: 'https://cdn.app.com/uploads/avatar/MB-Z891W.png',
    nullable: true,
  })
  avatar: string | null;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'user@example.com',
  })
  email: string | null;

  @ApiProperty({
    description: 'Current account status of the user',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @ApiProperty({
    description: 'Role of the user in the system',
    enum: UserRole,
    example: UserRole.CUSTOMER,
  })
  role: UserRole;
}

export class UserRecentActivityDto {
  @ApiProperty({ example: 'Loan Repayment' })
  title: string;

  @ApiProperty({ example: '₦25000 used to repay loan LN-E111.' })
  description: string;

  @ApiProperty({ example: '20 Apr 2025', format: 'date-time' })
  date: Date;

  @ApiProperty({
    example: 'Repayment',
    description: 'The source of this activity',
  })
  source: string;
}

export class UserPayrollDto extends OmitType(CreatePayrollDto, [
  'externalId',
] as const) {
  @ApiProperty({
    description: 'user external id that maps to external payroll handler',
    example: 'MB-0Y8UJ2',
  })
  userId: boolean;
}

export class UserIdentityDto extends CreateIdentityDto {
  // @ApiProperty({
  //   description: 'user id',
  //   example: 'MB-0Y8UJ2',
  // })
  // verified: boolean;
}
