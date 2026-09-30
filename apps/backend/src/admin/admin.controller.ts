import {
  Controller,
  Body,
  Post,
  Patch,
  HttpStatus,
  HttpCode,
  Get,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Access, BypassMaintenance } from 'src/auth/decorators';
import { InviteAdminDto, RemoveAdminDto } from './common/dto';
import { SettingsService } from 'src/settings/settings.service';
import {
  SettingsDto,
  toSettingsChanges,
  toSettingsDto,
  UpdateSettingsDto,
} from 'src/settings/dto/settings.dto';
import { ApiNullOkResponse, ApiOkBaseResponse } from 'src/common/decorators';
import { ApiRoleForbiddenResponse } from './common/decorators';
import { AdminListDto } from './common/entities';

@ApiTags('Super Admin')
@Access('SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all admin users' })
  @ApiOkBaseResponse(AdminListDto)
  @ApiRoleForbiddenResponse()
  async getAllAdmins() {
    const admins = await this.adminService.getAllAdmins();
    return {
      data: admins,
      message: 'Admin users successfully retrieved',
    };
  }

  @Post('invite-admin')
  @ApiOperation({ summary: 'Invite a new admin' })
  @ApiBody({
    type: InviteAdminDto,
    description:
      'Contains info of user like name and email to create a model for him/her',
  })
  @ApiNullOkResponse(
    'Indicates that the user has been successfully invited as an admin',
    'John Doe has been successfully invited',
  )
  @ApiRoleForbiddenResponse()
  async invite(@Body() dto: InviteAdminDto) {
    await this.adminService.inviteAdmin(dto);
    return { message: `${dto.name} has been successfully invited`, data: null };
  }

  @Patch('remove-admin')
  @ApiOperation({
    summary:
      'Remove an existing admin ~ deprecate to a customer with a flagged account',
  })
  @ApiBody({
    type: RemoveAdminDto,
    description: 'Contains admin id',
  })
  @ApiNullOkResponse(
    'Indicates that the user has been successfully removed as an admin',
    'John Doe has been removed',
  )
  @ApiRoleForbiddenResponse()
  async remove(@Body() dto: RemoveAdminDto) {
    const results = await this.adminService.removeAdmin(dto.id);
    return results;
  }

  @Patch('rate')
  @ApiOperation({
    summary:
      'Update any of the rates (percentages) and the net-pay cap; send only what changes',
  })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiOkBaseResponse(SettingsDto)
  @ApiRoleForbiddenResponse()
  async updateRate(@Body() dto: UpdateSettingsDto) {
    const settings = await this.settings.update(toSettingsChanges(dto));
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
  async toggleMaintenance() {
    const currentMode = await this.settings.toggleMaintenance();
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
