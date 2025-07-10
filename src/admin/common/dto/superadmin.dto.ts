import { ApiProperty } from '@nestjs/swagger';
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
}

export class UpdateRateDto {
  @ApiProperty({
    enum: ['INTEREST_RATE', 'MANAGEMENT_FEE_RATE'],
    description: 'Configuration key to update',
  })
  @IsIn(['INTEREST_RATE', 'MANAGEMENT_FEE_RATE'])
  key: 'INTEREST_RATE' | 'MANAGEMENT_FEE_RATE';

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
