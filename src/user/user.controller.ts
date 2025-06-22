import { Controller, Get, Patch, UseGuards, Req, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { AuthUser } from 'src/common/types';
import {
  ApiUserNotFoundResponse,
  ApiUserResponse,
  ApiUserUnauthorizedResponse,
} from './common/decorators';
import { UpdatePasswordDto, UpdateUserDto } from './common/dto';

@ApiTags('User')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiUserResponse()
  @ApiUserNotFoundResponse()
  @ApiUserUnauthorizedResponse()
  async getProfile(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    const user = await this.userService.getUserById(userId);
    return {
      message: `Profile data for ${user.name} has been successfully queried`,
      data: { user },
    };
  }

  @Patch()
  @ApiOperation({ summary: 'Update user profile' })
  @ApiUserResponse()
  @ApiUserNotFoundResponse()
  @ApiUserUnauthorizedResponse()
  async updateProfile(
    @Req() req: Request,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const { userId } = req.user as AuthUser;
    const user = await this.userService.updateUser(userId, updateUserDto);
    return {
      message: `Profile for ${user.name} has been successfully updated`,
      data: { user },
    };
  }

  @Patch('password')
  @ApiOperation({ summary: 'Update user password' })
  @ApiOkResponse({
    description: 'Password updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Password has been successfully updated',
        },
      },
    },
  })
  @ApiUserNotFoundResponse()
  @ApiUserUnauthorizedResponse({
    desc: 'Current password is incorrect',
    msg: 'Old password does not match existing password',
  })
  @ApiUserUnauthorizedResponse()
  async updatePassword(
    @Req() req: Request,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    const { userId } = req.user as AuthUser;
    await this.userService.updatePassword(userId, updatePasswordDto);
    return {
      message: 'Password has been successfully updated',
    };
  }

  // // --- Overview ---
  // @Get('overview')
  // @ApiOperation({ summary: 'Get user dashboard overview' })
  // async getOverview(@Req() req: Request) {
  //   return this.userService.getOverview(req.user.id);
  // }
}
