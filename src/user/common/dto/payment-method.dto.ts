import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

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

  @ApiProperty({
    description: 'User’s bank verification number (11 digits)',
    example: '01234567890',
  })
  @IsString()
  @Matches(/^\d{11}$/, { message: 'BVN must be 11 digits' })
  bvn: string;
}

export class UpdatePaymentMethodDto extends PartialType(
  CreatePaymentMethodDto,
) {}
