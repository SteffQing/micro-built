import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  IsOptional,
} from 'class-validator';

export class LoginBodyDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '08123456789' })
  @IsOptional()
  @IsPhoneNumber('NG')
  contact?: string;

  @ApiProperty({ example: 'Password123$$' })
  @IsNotEmpty()
  password: string;
}
