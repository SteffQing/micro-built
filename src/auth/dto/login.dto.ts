import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginBodyDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
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
      id: 'MB123456',
      name: 'John Doe',
      role: 'CUSTOMER',
    },
    description: 'User profile (without sensitive fields)',
  })
  user: {
    id: string;
    name: string;
    role: string;
  };
}

export class LoginResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: LoginResponseDto })
  data: LoginResponseDto;
}
