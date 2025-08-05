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
  ApiNotFoundResponse,
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
import { UpdatePasswordDto } from './common/dto';
import { LoanService } from './loan/loan.service';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiGenericErrorResponse,
  ApiOkBaseResponse,
} from 'src/common/decorators';
import {
  LoanOverviewDto,
  UserDto,
  UserIdentityDto,
  UserPaymentMethodDto,
  UserPayrollDto,
  UserRecentActivityDto,
} from './common/entities';

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
  @ApiExtraModels(UserRecentActivityDto)
  @ApiOkResponse({
    description: 'Collated user activity across multiple models',
    schema: {
      allOf: [
        {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(UserRecentActivityDto) },
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

  @Get('identity')
  @ApiOperation({
    summary: 'Get the current user’s identity verification documents',
  })
  @ApiOkBaseResponse(UserIdentityDto)
  async getUserIdentityInfo(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    const identityInfo = await this.userService.getIdentityInfo(userId);
    return {
      message: identityInfo
        ? 'Identity information for the user has been retrieved successfully'
        : 'Identity information not found for this user',
      data: identityInfo,
    };
  }

  @Get('payroll')
  @ApiOperation({ summary: 'Get user payroll data' })
  @ApiOkBaseResponse(UserPayrollDto)
  @ApiUserNotFoundResponse()
  @ApiUserUnauthorizedResponse()
  async getPayroll(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    return this.userService.getPayroll(userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get user’s payment method info' })
  @ApiOkBaseResponse(UserPaymentMethodDto)
  @ApiNotFoundResponse({ description: 'No payment method found for this user' })
  async getUserPaymentMethod(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    const data = await this.userService.getPaymentMethod(userId);
    if (data)
      return {
        data,
        message: 'Payment methods have been successfully queried',
      };
    return {
      data,
      message: 'No payment method found',
    };
  }
}
