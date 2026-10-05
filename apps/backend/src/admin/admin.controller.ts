import {
  Controller,
  Body,
  Post,
  Patch,
  HttpStatus,
  HttpCode,
  Get,
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
import { Access, BypassMaintenance, CurrentUser } from 'src/auth/decorators';
import type { AuthUser } from 'src/common/types';
import { InviteAdminDto, RemoveAdminDto } from './common/dto/superadmin.dto';
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

  @Patch('rate')
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
