import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { IsObject, IsString, Length, Matches } from 'class-validator';
import type { Request } from 'express';
import { ApiGenericErrorResponse } from 'src/common/decorators';
import type { AuthUser } from 'src/common/types';
import { confirmationOf } from './confirmation.guard';
import { ConfirmationsService } from './confirmations.service';
import { Access, BypassMaintenance, CurrentUser } from './decorators';

export class ConfirmWithCodeDto {
  @ApiProperty({ example: '123456', description: 'The current code from the authenticator app' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from your authenticator app' })
  code: string;
}

export class ConfirmWithPasskeyDto {
  @ApiProperty({ description: 'The `id` POST /confirmations/passkey/options returned' })
  @IsString()
  @Length(32, 32)
  id: string;

  @ApiProperty({ type: Object, description: "The browser's WebAuthn assertion (startAuthentication's result)" })
  @IsObject()
  response: AuthenticationResponseJSON;
}

class ConfirmationMethodsDto {
  @ApiProperty() totp: boolean;
  @ApiProperty() passkey: boolean;
}

class ConfirmationGrantDto {
  @ApiProperty({ description: 'Send as the X-Confirmation header (or `?confirmation=` on uploads)' })
  token: string;
  @ApiPropertyOptional() expiresAt: Date;
}

// Re-proving it's you before a gated action (@Confirm routes). Gets the token the X-Confirmation header carries.
@ApiTags('Confirmations')
@Access()
@BypassMaintenance()
@Controller('confirmations')
export class ConfirmationsController {
  constructor(private readonly confirmations: ConfirmationsService) {}

  @Get('methods')
  @ApiOperation({ summary: 'Which ways you can confirm: authenticator code, passkey' })
  async methods(@CurrentUser() user: AuthUser): Promise<{ data: ConfirmationMethodsDto; message: string }> {
    return { data: await this.confirmations.methods(user.userId), message: 'Confirmation methods' };
  }

  @Post('code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm with the authenticator code; five wrong codes lock it for 15 minutes' })
  @ApiGenericErrorResponse({ code: 403, err: 'Forbidden', desc: 'Wrong code', msg: 'That code is not correct. Use the current one from your app' })
  async code(@Body() dto: ConfirmWithCodeDto, @CurrentUser() user: AuthUser, @Req() request: Request) {
    const data: ConfirmationGrantDto = await this.confirmations.confirmWithCode(user.userId, sessionOf(request), dto.code);
    return { data, message: 'Confirmed' };
  }

  @Post('passkey/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Start a passkey prompt (WebAuthn request options for the user's own passkeys)" })
  async passkeyOptions(@CurrentUser() user: AuthUser, @Req() request: Request) {
    return { data: await this.confirmations.passkeyOptions(user.userId, sessionOf(request)), message: 'Use your passkey' };
  }

  @Post('passkey')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm with the passkey prompt's answer" })
  @ApiGenericErrorResponse({ code: 403, err: 'Forbidden', desc: 'Not verified', msg: 'That passkey could not be verified. Try again' })
  async passkey(@Body() dto: ConfirmWithPasskeyDto, @CurrentUser() user: AuthUser, @Req() request: Request) {
    const data: ConfirmationGrantDto = await this.confirmations.confirmWithPasskey(
      user.userId,
      sessionOf(request),
      dto.id,
      dto.response,
    );
    return { data, message: 'Confirmed' };
  }
}

function sessionOf(request: Request): string {
  const { sessionId } = confirmationOf(request);
  // AccessGuard always attaches the session of a signed-in user.
  return sessionId ?? '';
}
