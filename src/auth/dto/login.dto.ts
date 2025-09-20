import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
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
  @Transform(({ value }) => (value ? value.toLowerCase() : value))
  email?: string;

  @ApiPropertyOptional({ example: '08123456789' })
  @IsOptional()
  @IsPhoneNumber('NG')
  contact?: string;

  @ApiProperty({ example: 'Password123$$' })
  @IsNotEmpty()
  password: string;
}
