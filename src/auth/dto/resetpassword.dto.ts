import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class ResetPasswordBodyDto {
  @ApiProperty({
    example: 'newPassword123',
    description: 'New password for the user account',
  })
  @IsNotEmpty()
  @Length(8, 50)
  newPassword: string;

  @ApiProperty({
    example: 'resetToken123',
    description: 'Reset token received via email',
  })
  @IsNotEmpty()
  token: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({
    example: 'Password reset successful',
    description: 'Confirmation message for password reset',
  })
  message: string;

  @ApiProperty({
    example: { email: 'user@example.com' },
    description: 'Email address where password was reset',
  })
  data: { email: string };
}

export class ForgotPasswordBodyDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address to receive reset instructions',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({
    example: 'Password reset instructions sent to your email',
    description: 'Confirmation message for password reset request',
  })
  message: string;

  @ApiProperty({
    example: { email: 'user@example.com' },
    description: 'Email address where reset instructions were sent',
  })
  data: { email: string };
}
