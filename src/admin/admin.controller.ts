import {
  Controller,
  UseGuards,
  Body,
  Post,
  Patch,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
} from '@nestjs/swagger';
import { InviteAdminDto } from './common/dto';
import { ConfigService } from 'src/config/config.service';
import { UpdateRateDto } from './common/dto';
import { ResponseDto } from 'src/common/dto';
import { ApiNullOkResponse } from 'src/common/decorators';
import { ApiRoleForbiddenResponse } from './common/decorators';

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
  @ApiBody({
    type: InviteAdminDto,
    description:
      'Contains info of admin like name and email to create a user model for him/her',
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
    return { message: `${dto.key.replace('_', ' ')} has been updated` };
  }

  @Patch('maintenance')
  @ApiOperation({ summary: 'Toggle maintenance mode (on/off)' })
  @ApiNullOkResponse(
    'Maintenance mode toggled successfully',
    'Maintenance mode is now ON',
  )
  @HttpCode(HttpStatus.OK)
  @ApiRoleForbiddenResponse()
  async toggleMaintenance() {
    const currentMode = await this.config.toggleMaintenanceMode();
    return {
      message: `Maintenance mode is now ${currentMode ? 'ON' : 'OFF'}`,
    };
  }
}
