import { IsOptional, IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User contact information',
    example: '08029640202',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(11, 11)
  contact?: string;

  @ApiPropertyOptional({
    description: 'User full name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}

export class UpdatePasswordDto {
  @ApiPropertyOptional({
    description: 'Current password',
    example: 'oldPassword123',
  })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiPropertyOptional({
    description: 'New password',
    example: 'newPassword123',
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 50)
  newPassword: string;
}
