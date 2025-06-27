import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginBodyDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123$$' })
  @IsNotEmpty()
  password: string;
}

class LoginDataDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token',
  })
  token: string;

  @ApiProperty({
    example: {
      id: 'MB-123456',
      role: UserRole.CUSTOMER,
    },
    description: 'User profile (without sensitive fields)',
  })
  user: {
    id: string;
    role: UserRole;
  };
}

export class LoginResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: LoginDataDto })
  data: LoginDataDto;
}
