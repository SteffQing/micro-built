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
