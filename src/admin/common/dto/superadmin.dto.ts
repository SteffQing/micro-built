import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class InviteAdminDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address to receive reset instructions',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Name of admin',
  })
  @IsString()
  name: string;

  @ApiProperty({
    enum: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
    example: UserRole.ADMIN,
    description: 'The role to assign the admin',
  })
  @IsIn([UserRole.ADMIN, UserRole.SUPER_ADMIN])
  role: UserRole;
}

export class RemoveAdminDto {
  @ApiProperty({
    example: 'AD-1M8KI4',
    description: 'User Id of the admin to be removed',
  })
  @IsString()
  id: string;
}

export class UpdateRateDto {
  @ApiProperty({
    enum: ['INTEREST_RATE', 'MANAGEMENT_FEE_RATE', 'PENALTY_FEE_RATE'],
    description: 'Configuration key to update',
  })
  @IsIn(['INTEREST_RATE', 'MANAGEMENT_FEE_RATE', 'PENALTY_FEE_RATE'])
  key: 'INTEREST_RATE' | 'MANAGEMENT_FEE_RATE' | 'PENALTY_FEE_RATE';

  @ApiProperty({
    example: 1.5,
    description: 'New value for the rate (must be between 1 and 100)',
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  value: number;
}

export class CommodityDto {
  @ApiProperty({
    example: 'Laptop',
    description: 'Name of the commodity/asset',
  })
  @IsString()
  name: string;
}
