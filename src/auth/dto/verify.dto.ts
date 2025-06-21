import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class VerifyCodeDto {
  @ApiProperty({ example: '123456' })
  @IsNotEmpty()
  @Length(6, 6)
  code: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}
