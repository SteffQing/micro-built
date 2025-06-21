import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ForgotPasswordBodyDto,
  ForgotPasswordResponseDto,
  LoginBodyDto,
  LoginResponseDto,
  ResendCodeBodyDto,
  ResetPasswordBodyDto,
  ResetPasswordResponseDto,
  SignupBodyDto,
  SignupResponseDto,
  VerifyCodeBodyDto,
  VerifyCodeResponseDto,
} from './dto';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiUnauthorizedResponse,
  ApiInvalidUserResponse,
} from 'src/common/decorators';

@ApiTags('Authentication')
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
  @ApiCreatedResponse({
    description: 'Signup successful. Verification code sent to your email.',
    type: SignupResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists',
  })
  async signup(@Body() dto: SignupBodyDto) {
    const { message, userId } = await this.authService.signup(dto);
    return { data: { userId }, message };
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
  @ApiOkResponse({
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiInvalidUserResponse()
  @ApiResponse({
    status: 404,
    description: 'User not found (email not registered)',
  })
  async login(@Body() dto: LoginBodyDto) {
    const res = await this.authService.login(dto);
    return {
      data: res,
      message: `Welcome back to MicroBuilt, ${res.user.name}!`,
    };
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
  @ApiOkResponse({
    description: 'Account activated successfully',
    type: VerifyCodeResponseDto,
  })
  @ApiUnauthorizedResponse()
  async verifyCode(@Body() dto: VerifyCodeBodyDto) {
    const { message, userId } = await this.authService.verifyCode(dto);
    return {
      data: { userId },
      message,
    };
  }

  @Post('resend-code')
  @ApiOperation({
    summary: 'Resend verification code',
    description:
      'Resends a new verification code to the provided email address',
  })
  @ApiBody({ type: ResendCodeBodyDto })
  @ApiOkResponse({
    description: 'Code resent successfully',
    type: VerifyCodeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (invalid email format)',
    schema: {
      example: {
        statusCode: 400,
        message: ['email must be an email'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Email not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'User with this email does not exist',
        error: 'Not Found',
      },
    },
  })
  async resendVerificationCode(@Body() resendCodeDto: ResendCodeBodyDto) {
    const { message, userId } = await this.authService.resendCode(
      resendCodeDto.email,
    );
    return { data: { userId }, message };
  }
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Sends a password reset code to the provided email address',
  })
  @ApiBody({ type: ForgotPasswordBodyDto })
  @ApiOkResponse({
    description: 'Password reset code sent successfully',
    type: ForgotPasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (invalid email format)',
    schema: {
      example: {
        statusCode: 400,
        message: ['email must be an email'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Email not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'User with this email does not exist',
        error: 'Not Found',
      },
    },
  })
  async forgotPassword(@Body() dto: ForgotPasswordBodyDto) {
    const { message } = await this.authService.forgotPassword(dto.email);
    return { data: { email: dto.email }, message };
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password with token',
    description:
      'Resets the password using the verification token sent to email',
  })
  @ApiBody({ type: ResetPasswordBodyDto })
  @ApiOkResponse({
    description: 'Password reset successful',
    type: ResetPasswordResponseDto,
  })
  @ApiUnauthorizedResponse()
  async resetPassword(@Body() dto: ResetPasswordBodyDto) {
    const { message, email } = await this.authService.resetPassword(dto);
    return { data: { email }, message };
  }
}
