import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class ResetPasswordBodyDto {
  @ApiProperty({
    example: 'newPassword123',
    description: 'New password for the user account',
  })
  @IsNotEmpty()
  @Length(8, 50)
  @Matches(/(?=.*[a-z])/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/(?=.*[A-Z])/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/(?=.*\d)/, {
    message: 'Password must contain at least one number',
  })
  @Matches(/(?=.*[@$!%*?&])/, {
    message: 'Password must contain at least one special character (@$!%*?&)',
  })
  newPassword: string;

  @ApiProperty({
    example: 'resetToken123',
    description: 'Reset token received via email',
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}

export class ForgotPasswordBodyDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address to receive reset instructions',
  })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => (value ? value.toLowerCase() : value))
  email: string;
}
