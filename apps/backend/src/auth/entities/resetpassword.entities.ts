import { ApiProperty } from '@nestjs/swagger';

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
