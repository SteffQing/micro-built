import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class VerifyCodeBodyDto {
  @ApiProperty({ example: '123456' })
  @IsNotEmpty()
  @Length(6, 6)
  code: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class VerifyCodeResponseDto {
  @ApiProperty({
    example: 'User successfully verified',
    description: 'Confirmation message',
  })
  message: string;

  @ApiProperty({
    example: { userId: 'MB-123456' },
    description: 'Unique ID of the newly created user',
  })
  data: { userId: string };
}

export class ResendCodeBodyDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address to resend verification code',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
