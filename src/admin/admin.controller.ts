import { Controller, Patch, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Patch('upgrade/:userId')
  @Roles('SUPER_ADMIN') // Only super admins can upgrade others to admin
  upgradeUser(@Param('userId') userId: string) {
    return this.adminService.upgradeUserToAdmin(userId);
  }

  @Patch('make-vendor/:userId')
  @Roles('ADMIN') // Let admin promote a user to vendor
  makeVendor(@Param('userId') userId: string) {
    return this.adminService.upgradeUserToVendor(userId);
  }
}
