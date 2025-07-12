import { ApiProperty } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, IsOptional } from 'class-validator';

export class CreatePaymentMethodDto {
  @ApiProperty({
    description: 'Name of the user’s bank (e.g. Access Bank)',
    example: 'Access Bank',
  })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({
    description: 'User’s bank account number (10 digits)',
    example: '0123456789',
  })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'Account number must be 10 digits' })
  accountNumber: string;

  @ApiProperty({
    description: 'Full name on the bank account',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  accountName: string;
}

export class UpdatePaymentMethodDto {
  @ApiPropertyOptional({
    description: 'Updated bank name',
    example: 'Zenith Bank',
  })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({
    description: 'Updated account number',
    example: '0987654321',
  })
  @IsOptional()
  @Matches(/^\d{10}$/, { message: 'Account number must be 10 digits' })
  accountNumber?: string;

  @ApiPropertyOptional({
    description: 'Updated account holder name',
    example: 'Jane Smith',
  })
  @IsOptional()
  @IsString()
  accountName?: string;
}
