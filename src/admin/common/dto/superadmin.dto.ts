import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsNumber, IsString } from 'class-validator';

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
}

export class UpdateRateDto {
  @ApiProperty({ enum: ['INTEREST_RATE', 'MANAGEMENT_FEE_RATE'] })
  @IsIn(['INTEREST_RATE', 'MANAGEMENT_FEE_RATE'])
  key: 'INTEREST_RATE' | 'MANAGEMENT_FEE_RATE';

  @ApiProperty({ example: 1.5 })
  @IsNumber()
  value: number;
}
