import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginBodyDto,
  LoginResponseDto,
  SignupBodyDto,
  SignupResponseDto,
  VerifyCodeBodyDto,
  VerifyCodeResponseDto,
} from './dto';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Creates a user account and sends a verification email.',
  })
  @ApiBody({
    type: SignupBodyDto,
    description: 'User registration details',
  })
  @ApiResponse({
    status: 201,
    description: 'Signup successful. Verification code sent to your email.',
    type: SignupResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists',
  })
  signup(@Body() dto: SignupBodyDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Authenticate a user',
    description: 'Validates credentials and returns a JWT token.',
  })
  @ApiBody({
    type: LoginBodyDto,
    description: 'User login credentials',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or inactive account',
    schema: {
      examples: {
        invalidCredentials: {
          value: {
            statusCode: 401,
            message: 'Invalid credentials',
            error: 'Unauthorized',
          },
        },
        inactiveAccount: {
          value: {
            statusCode: 401,
            message: 'User account is inactive',
            error: 'Unauthorized',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found (email not registered)',
  })
  login(@Body() dto: LoginBodyDto) {
    return this.authService.login(dto);
  }

  @Post('verify-code')
  @ApiOperation({
    summary: 'Verify user email with a code',
    description:
      "Validates the 6-digit code sent to the user's email and activates the account.",
  })
  @ApiBody({
    type: VerifyCodeBodyDto,
    description: 'Email and verification code',
  })
  @ApiResponse({
    status: 200,
    description: 'Account activated successfully',
    type: VerifyCodeResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid/expired code',
    schema: {
      examples: {
        expiredCode: {
          value: {
            statusCode: 401,
            message: 'Verification code expired',
            error: 'Unauthorized',
          },
        },
        invalidCode: {
          value: {
            statusCode: 401,
            message: 'Invalid verification code',
            error: 'Unauthorized',
          },
        },
      },
    },
  })
  verifyCode(@Body() dto: VerifyCodeBodyDto) {
    return this.authService.verifyCode(dto);
  }
}
