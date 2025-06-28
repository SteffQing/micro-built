import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus, UserRole } from '@prisma/client';

export class UpdatePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'oldPassword123',
  })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({
    description: 'New password',
    example: 'newPassword123',
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 50)
  newPassword: string;
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
  email: string;

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
