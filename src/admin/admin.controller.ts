import {
  Controller,
  UseGuards,
  Body,
  Post,
  Patch,
  HttpStatus,
  HttpCode,
  Delete,
  Get,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { BypassMaintenance, Roles } from '../auth/roles.decorator';
import { InviteAdminDto, RemoveAdminDto } from './common/dto';
import { ConfigService } from 'src/config/config.service';
import { UpdateRateDto, CommodityDto } from './common/dto';
import { ApiNullOkResponse, ApiOkBaseResponse } from 'src/common/decorators';
import { ApiRoleForbiddenResponse } from './common/decorators';
import { AdminListDto } from './common/entities';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly config: ConfigService,
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
  @ApiOperation({ summary: 'Update interest or management fee rate' })
  @ApiBody({
    type: UpdateRateDto,
    description: 'Set interest rate or management fee rate between 1% - 100%',
  })
  @ApiNullOkResponse(
    'Indicates that the rates on the platform has been updated',
    'INTEREST RATE has been updated',
  )
  @ApiRoleForbiddenResponse()
  async updateRate(@Body() dto: UpdateRateDto) {
    await this.config.setRate(dto.key, dto.value);
    return {
      message: `${dto.key.replace('_', ' ').toLowerCase()} has been updated`,
      data: null,
    };
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
    const currentMode = await this.config.toggleMaintenanceMode();
    const text = currentMode
      ? 'All platform actions are currently paused'
      : 'Platform activities are sucessfully resumed';
    return {
      message: `Maintenance mode is now ${currentMode ? 'On' : 'Off'}. ${text}`,
      data: null,
    };
  }

  @Post('commodities')
  @ApiOperation({ summary: 'Add a new commodity' })
  @ApiNullOkResponse(
    'Commodity added successfully',
    'Commodity added successfully',
  )
  @HttpCode(HttpStatus.OK)
  @ApiRoleForbiddenResponse()
  async addCommodity(@Body() dto: CommodityDto) {
    await this.config.addNewCommodityCategory(dto.name);
    return {
      data: null,
      message: 'Commodity added successfully',
    };
  }

  @Delete('commodities')
  @ApiOperation({ summary: 'Remove a commodity' })
  @ApiNullOkResponse(
    'Commodity removed successfully',
    'Commodity removed successfully',
  )
  @HttpCode(HttpStatus.OK)
  @ApiRoleForbiddenResponse()
  async removeCommodity(@Body() dto: CommodityDto) {
    await this.config.removeCommodityCategory(dto.name);
    return {
      data: null,
      message: 'Commodity removed successfully',
    };
  }
}
