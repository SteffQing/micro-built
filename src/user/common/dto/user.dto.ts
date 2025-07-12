import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'oldPassword123',
  })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({
    description: 'New password',
    example: 'newPassword123',
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 50)
  newPassword: string;
}
