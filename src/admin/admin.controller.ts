import { Controller, UseGuards, Body, Post, Patch } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { InviteAdminDto } from './common/dto';
import { ConfigService } from 'src/config/config.service';
import { UpdateRateDto } from './common/dto';

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

  @Post('invite')
  @ApiOperation({ summary: 'Invite a new admin' })
  async invite(@Body() dto: InviteAdminDto) {
    await this.adminService.inviteAdmin(dto);
    return { message: `${dto.name} has been successfully invited` };
  }

  @Patch('rate')
  @ApiOperation({ summary: 'Update interest or management fee rate' })
  @ApiBody({ type: UpdateRateDto })
  async updateRate(@Body() dto: UpdateRateDto) {
    await this.config.setRate(dto.key, dto.value);
    return { message: `${dto.key.replace('_', ' ')} has been updated` };
  }

  @Patch('maintenance')
  @ApiOperation({ summary: 'Toggle maintenance mode (on/off)' })
  async toggleMaintenance() {
    const currentMode = await this.config.toggleMaintenanceMode();
    return {
      message: `Maintenance mode is now ${currentMode ? 'ON' : 'OFF'}`,
    };
  }
}
