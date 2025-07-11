import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class LoginDataDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token',
  })
  token: string;

  @ApiProperty({
    example: {
      id: 'MB-123456',
      role: UserRole.CUSTOMER,
    },
    description: 'User profile (without sensitive fields)',
  })
  user: {
    id: string;
    role: UserRole;
  };
}

export class SignupResponseDto {
  @ApiProperty({
    example: 'Signup successful. Verification code sent to your email.',
    description: 'Confirmation message',
  })
  message: string;

  @ApiProperty({
    example: { userId: 'MB-123456' },
    description: 'Unique ID of the newly created user',
  })
  data: { userId: string };
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
