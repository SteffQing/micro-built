import {
  Controller,
  Get,
  Patch,
  UseGuards,
  Req,
  Body,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  Post,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { AuthUser } from 'src/common/types';
import {
  ApiUserNotFoundResponse,
  ApiUserUnauthorizedResponse,
} from './common/decorators';
import {
  LoanOverviewDto,
  RecentActivityDto,
  UpdatePasswordDto,
  UserDto,
} from './common/dto';
import { LoanService } from './loan/loan.service';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiGenericErrorResponse,
  ApiOkBaseResponse,
} from 'src/common/decorators';

@ApiTags('User')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly loanService: LoanService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkBaseResponse(UserDto)
  @ApiUserNotFoundResponse()
  @ApiUserUnauthorizedResponse()
  async getProfile(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    const user = await this.userService.getUserById(userId);
    return {
      message: `Profile data for ${user.name} has been successfully queried`,
      data: user,
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
        data: {
          type: 'object',
          example: null,
        },
      },
    },
  })
  @ApiUserNotFoundResponse()
  @ApiUserUnauthorizedResponse()
  @ApiGenericErrorResponse({
    msg: 'Old password does not match existing password',
    code: 401,
    err: 'Unauthorized',
    desc: 'Provided password does not match current password',
  })
  async updatePassword(
    @Req() req: Request,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    const { userId } = req.user as AuthUser;
    await this.userService.updatePassword(userId, updatePasswordDto);
    return {
      message: 'Password has been successfully updated',
      data: null,
    };
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Update user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
    description: 'Passes in a file (image type only)',
  })
  @ApiCreatedResponse({
    description: 'Avatar uploaded successfully',
    schema: {
      example: {
        message: 'Avatar has been successfully updated!',
        data: {
          url: 'https://xyz.supabase.co/storage/user-avatar/userid.png',
        },
      },
    },
  })
  @ApiUserUnauthorizedResponse()
  @ApiBadRequestResponse({
    description: 'Invalid file type or no file provided',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid file type',
        error: 'Bad Request',
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 3 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new BadRequestException('Invalid file type'), false);
      },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const { userId } = req.user as AuthUser;
    return this.userService.uploadAvatar(file, userId);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get user dashboard overview' })
  @ApiOkBaseResponse(LoanOverviewDto)
  @ApiUserUnauthorizedResponse()
  async getOverview(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    const overview = await this.loanService.getUserLoansOverview(userId);
    return {
      data: overview,
      message: 'User loans overview successfully queried',
    };
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Get user’s recent activity feed' })
  @ApiExtraModels(RecentActivityDto)
  @ApiOkResponse({
    description: 'Collated user activity across multiple models',
    schema: {
      allOf: [
        {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(RecentActivityDto) },
            },
            message: {
              type: 'string',
              example: 'User activity successfully queried',
            },
          },
        },
      ],
    },
  })
  @ApiUserUnauthorizedResponse()
  async getRecentActivity(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    const activities = await this.userService.getRecentActivities(userId);
    return { data: activities, message: 'User activity successfully queried' };
  }
}
