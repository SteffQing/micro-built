import {
  Controller,
  Body,
  Post,
  Patch,
  HttpStatus,
  HttpCode,
  Get,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { AdminService, EMAIL_TAKEN, LAST_SUPER_ADMIN } from './admin.service';
import { Access, BypassMaintenance, Confirm, CurrentUser } from 'src/auth/decorators';
import type { AuthUser } from 'src/common/types';
import { ChangeAdminRoleDto, InviteAdminDto, RemoveAdminDto, ResetSignInDto } from './common/dto/superadmin.dto';
import { SettingsService } from 'src/settings/settings.service';
import {
  SettingsDto,
  toSettingsChanges,
  toSettingsDto,
  UpdateSettingsDto,
} from 'src/settings/dto/settings.dto';
import {
  ApiDtoErrorResponse,
  ApiGenericErrorResponse,
  ApiNullOkResponse,
  ApiOkBaseResponse,
} from 'src/common/decorators';
import { BaseResponseDto } from 'src/common/dto';
import { ApiRoleForbiddenResponse } from './common/decorators';
import { AdminListDto } from './common/entities/superadmin.entities';

@ApiTags('Super Admin')
@Access('SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List admins (removed ones included as INACTIVE; the SYSTEM account excluded)',
  })
  @ApiExtraModels(BaseResponseDto, AdminListDto)
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        { properties: { data: { type: 'array', items: { $ref: getSchemaPath(AdminListDto) } } } },
      ],
    },
  })
  @ApiRoleForbiddenResponse()
  async getAllAdmins() {
    const admins = await this.adminService.getAllAdmins();
    return {
      data: admins,
      message: 'Admin users successfully retrieved',
    };
  }

  @Post('invite-admin')
  @Confirm('window')
  @ApiOperation({
    summary:
      'Invite an admin: creates the account and emails a first password. A removed admin with that email is re-activated with the new role and a new password (2FA set up again).',
  })
  @ApiBody({ type: InviteAdminDto })
  @ApiNullOkResponse(
    'The admin has been invited (or re-activated). If the email failed, the message says so.',
    'John Doe has been successfully invited',
  )
  @ApiDtoErrorResponse(['email must be an email'])
  @ApiGenericErrorResponse({
    desc: 'The email belongs to another account (a customer or an admin who is not removed)',
    code: 409,
    err: 'Conflict',
    msg: EMAIL_TAKEN,
  })
  @ApiRoleForbiddenResponse()
  async invite(@Body() dto: InviteAdminDto, @CurrentUser() user: AuthUser) {
    const result = await this.adminService.inviteAdmin(dto, user.userId);
    const done = result.reactivated
      ? `${result.name} has been re-activated as ${dto.role}`
      : `${result.name} has been successfully invited`;
    const message = result.emailSent
      ? done
      : `${done}, but the invite email could not be sent. Ask them to reset their password from the sign-in page.`;
    return { message, data: null };
  }

  @Patch('remove-admin')
  @Confirm('window')
  @ApiOperation({
    summary:
      'Remove an admin: the account becomes INACTIVE and is signed out everywhere (kept for audit history)',
  })
  @ApiBody({ type: RemoveAdminDto })
  @ApiNullOkResponse('The admin has been removed', 'John Doe has been removed')
  @ApiGenericErrorResponse({
    desc: 'Removing yourself or the system account',
    code: 400,
    err: 'Bad Request',
    msg: 'You cannot remove your own admin account',
  })
  @ApiGenericErrorResponse({
    desc: 'No admin with this id',
    code: 404,
    err: 'Not Found',
    msg: 'No admin found with this id',
  })
  @ApiGenericErrorResponse({
    desc: 'Already removed, or the last active super admin',
    code: 409,
    err: 'Conflict',
    msg: LAST_SUPER_ADMIN,
  })
  @ApiRoleForbiddenResponse()
  async remove(@Body() dto: RemoveAdminDto, @CurrentUser() user: AuthUser) {
    const { name } = await this.adminService.removeAdmin(dto.id, user.userId);
    return { data: null, message: `${name} has been removed` };
  }

  @Patch('admins/:id/role')
  @Confirm('window')
  @ApiOperation({
    summary: "Change an admin's role",
    description:
      'Not your own, not the SYSTEM account, and never the last active super admin (409). Audited (ADMIN_ROLE_CHANGED); ' +
      'the admin is notified. A new super admin without 2FA or a passkey is asked to set one up.',
  })
  @ApiBody({ type: ChangeAdminRoleDto })
  @ApiNullOkResponse('The role has been changed', 'Ada Obi is now a super admin')
  @ApiGenericErrorResponse({ desc: 'Your own role', code: 400, err: 'Bad Request', msg: 'You cannot change your own role: ask another super admin' })
  @ApiGenericErrorResponse({ desc: 'No admin with this id', code: 404, err: 'Not Found', msg: 'No admin found with this id' })
  @ApiGenericErrorResponse({ desc: 'Removed, same role, or the last super admin', code: 409, err: 'Conflict', msg: LAST_SUPER_ADMIN })
  @ApiRoleForbiddenResponse()
  async changeRole(@Param('id') id: string, @Body() dto: ChangeAdminRoleDto, @CurrentUser() user: AuthUser) {
    const { name } = await this.adminService.changeRole(id, dto.role, user.userId);
    const role = { SUPER_ADMIN: 'a super admin', ADMIN: 'an admin', MARKETER: 'a marketer', SYSTEM: 'the system account' }[dto.role];
    return { data: null, message: `${name} is now ${role}` };
  }

  @Post('users/:id/reset-sign-in')
  @HttpCode(HttpStatus.OK)
  @Confirm('action')
  @ApiOperation({
    summary: "Reset a locked-out user's sign-in (customer or admin)",
    description:
      'Removes their 2FA and passkeys and signs them out everywhere, for someone who lost their phone, authenticator ' +
      'or security key. Not your own (another super admin does it) or the SYSTEM account. Audited with the reason ' +
      '(SIGN_IN_RESET); the user is told in-app and by email or SMS.',
  })
  @ApiBody({ type: ResetSignInDto })
  @ApiNullOkResponse('Their sign-in has been reset', "Ada Obi's sign-in has been reset: 2FA and 1 passkey removed")
  @ApiGenericErrorResponse({ desc: 'Your own account', code: 400, err: 'Bad Request', msg: 'You cannot reset your own sign-in: ask another super admin' })
  @ApiGenericErrorResponse({ desc: 'No user with this id', code: 404, err: 'Not Found', msg: 'No user found with this id' })
  @ApiRoleForbiddenResponse()
  async resetSignIn(@Param('id') id: string, @Body() dto: ResetSignInDto, @CurrentUser() user: AuthUser) {
    const result = await this.adminService.resetSignIn(id, dto.reason, user.userId);
    const removed = [
      ...(result.twoFactor ? ['2FA'] : []),
      ...(result.passkeys ? [`${result.passkeys} passkey${result.passkeys === 1 ? '' : 's'}`] : []),
    ];
    const what = removed.length ? `${removed.join(' and ')} removed` : 'they had no 2FA or passkeys';
    return { data: null, message: `${result.name}'s sign-in has been reset (${what}) and they were signed out everywhere` };
  }

  @Patch('rate')
  @Confirm('window')
  @ApiOperation({
    summary:
      'Update any of the rates (percentages) and the net-pay cap; send only what changes',
  })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiOkBaseResponse(SettingsDto)
  @ApiRoleForbiddenResponse()
  async updateRate(@Body() dto: UpdateSettingsDto, @CurrentUser() user: AuthUser) {
    const settings = await this.settings.update(toSettingsChanges(dto), user.userId);
    return { data: toSettingsDto(settings), message: 'Settings updated' };
  }

  @Patch('maintenance')
  @Confirm('window')
  @ApiOperation({ summary: 'Toggle maintenance mode (on/off)' })
  @ApiNullOkResponse(
    'Maintenance mode toggled successfully',
    'Maintenance mode is now ON',
  )
  @HttpCode(HttpStatus.OK)
  @BypassMaintenance()
  @ApiRoleForbiddenResponse()
  async toggleMaintenance(@CurrentUser() user: AuthUser) {
    const currentMode = await this.settings.toggleMaintenance(user.userId);
    const text = currentMode
      ? 'All platform actions are currently paused'
      : 'Platform activities are sucessfully resumed';
    return {
      message: `Maintenance mode is now ${currentMode ? 'On' : 'Off'}. ${text}`,
      data: null,
    };
  }

  // /queues checks the better-auth session itself (the cookie reaches the API's domain, D8), so
  // there is nothing to set up: this only tells the dashboard the queues will open.
  @Get('queues/login')
  @ApiOperation({ summary: 'Check that the queues dashboard (/queues) will open' })
  @ApiNullOkResponse('The queues dashboard is available', 'Queues dashboard is available')
  bridge() {
    return { data: null, message: 'Queues dashboard is available' };
  }
}
