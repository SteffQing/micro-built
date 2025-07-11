import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ForgotPasswordBodyDto,
  LoginBodyDto,
  ResendCodeBodyDto,
  ResetPasswordBodyDto,
  SignupBodyDto,
  VerifyCodeBodyDto,
} from './dto';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiCodeErrorResponse,
  ApiInvalidUserResponse,
  ApiGenericErrorResponse,
  ApiDtoErrorResponse,
  ApiOkBaseResponse,
} from 'src/common/decorators';
import {
  ForgotPasswordResponseDto,
  LoginDataDto,
  ResetPasswordResponseDto,
  SignupResponseDto,
  VerifyCodeResponseDto,
} from './entities';

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
  @ApiGenericErrorResponse({
    desc: 'Provided email for signup already exists',
    err: 'Conflict',
    code: 409,
    msg: 'Email already exists',
  })
  @ApiDtoErrorResponse([
    'email must be an email',
    'password should not be empty',
    'password must be longer than or equal to 8 characters',
    'Password must contain at least one lowercase letter',
    'Password must contain at least one uppercase letter',
    'Password must contain at least one number',
    'Password must contain at least one special character (@$!%*?&)',
  ])
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
  @ApiOkBaseResponse(LoginDataDto)
  @ApiInvalidUserResponse()
  @ApiGenericErrorResponse({
    desc: 'User not found (email not registered)',
    err: 'Not Found',
    code: 404,
    msg: 'User not found',
  })
  @ApiDtoErrorResponse([
    'email must be an email',
    'password should not be empty',
  ])
  async login(@Body() dto: LoginBodyDto) {
    const res = await this.authService.login(dto);
    return {
      data: res,
      message: `Welcome back to MicroBuilt!`,
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
    description: 'Verify user email via verification code',
  })
  @ApiOkResponse({
    description: 'Account activated successfully',
    type: VerifyCodeResponseDto,
  })
  @ApiCodeErrorResponse()
  @ApiDtoErrorResponse([
    'code should not be empty',
    'code must be exactly 6 characters long',
    'email must be an email',
  ])
  async verifySignupCode(@Body() dto: VerifyCodeBodyDto) {
    const { message, userId } = await this.authService.verifySignupCode(dto);
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
  @ApiBody({
    description: 'Request a new code by providing an email address',
    type: ResendCodeBodyDto,
  })
  @ApiOkResponse({
    description: 'Code resent successfully',
    type: VerifyCodeResponseDto,
  })
  @ApiDtoErrorResponse('email must be an email')
  @ApiGenericErrorResponse({
    desc: 'User with provided email address was not found (email not registered)',
    err: 'Not Found',
    code: 404,
    msg: 'User with this email does not exist',
  })
  async resendVerificationCode(@Body() dto: ResendCodeBodyDto) {
    const { message, userId } = await this.authService.resendCode(dto.email);
    return { data: { userId }, message };
  }
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Sends a password reset code to the provided email address',
  })
  @ApiBody({
    description:
      'Request a password reset link by providing an email address of a valid user',
    type: ForgotPasswordBodyDto,
  })
  @ApiOkResponse({
    description: 'Password reset code sent successfully',
    type: ForgotPasswordResponseDto,
  })
  @ApiDtoErrorResponse('email must be an email')
  @ApiGenericErrorResponse({
    code: 404,
    msg: 'User with this email does not exist',
    err: 'Not Found',
    desc: 'Provided email does not match any on record!',
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
  @ApiBody({
    description: 'Update password with a valid token gotten from email',
    type: ResetPasswordBodyDto,
  })
  @ApiOkResponse({
    description: 'Password reset successful',
    type: ResetPasswordResponseDto,
  })
  @ApiGenericErrorResponse({
    desc: 'Reset token is expired',
    err: 'Unauthorized',
    code: 401,
    msg: 'Invalid or expired reset token',
  })
  @ApiGenericErrorResponse({
    desc: 'Email provided does not match to any user',
    err: 'Not Found',
    code: 404,
    msg: 'User with this email does not exist',
  })
  @ApiDtoErrorResponse([
    'token should not be empty',
    'token must be a string',
    'newPassword should not be empty',
    'newPassword must be longer than or equal to 8 characters',
    'newPassword must be shorter than or equal to 50 characters',
    'Password must contain at least one lowercase letter',
    'Password must contain at least one uppercase letter',
    'Password must contain at least one number',
    'Password must contain at least one special character (@$!%*?&)',
  ])
  async resetPassword(@Body() dto: ResetPasswordBodyDto) {
    const { message, email } = await this.authService.resetPassword(dto);
    return { data: { email }, message };
  }
}
