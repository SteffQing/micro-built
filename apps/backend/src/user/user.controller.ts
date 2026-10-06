import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Observable } from 'rxjs';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Access, AllowWithoutTwoFactor, CurrentUser } from 'src/auth/decorators';
import type { AuthUser } from 'src/common/types';
import {
  ApiDtoErrorResponse,
  ApiGenericErrorResponse,
  ApiNullOkResponse,
  ApiOkBaseResponse,
} from 'src/common/decorators';
import { BaseResponseDto, MetaDto, PaginatedQueryDto } from 'src/common/dto/generic.dto';
import { InappService } from 'src/notifications/inapp.service';
import { NotificationStreamService } from 'src/notifications/notification-stream.service';
import { ChangeRequestDto } from 'src/change-requests/change-requests.dto';
import {
  ApiCustomerOnlyResponse,
  ApiUserNotFoundResponse,
  ApiUserUnauthorizedResponse,
} from './common/decorators/auth-user';
import { CreateIdentityDto, UpdateIdentityDto } from './common/dto/identity.dto';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './common/dto/payment-method.dto';
import {
  UserAvatarDto,
  UserDto,
  UserIdentityDto,
  UserNotificationsDto,
  UserOverviewDto,
  UserPaymentMethodDto,
  UserPayrollDto,
  UserRecentActivityDto,
} from './common/entities/user.entities';
import {
  ACCOUNT_NUMBER_TAKEN,
  BVN_TAKEN,
  CHANGE_SUBMITTED,
  PPIService,
} from './ppi.service';
import { UserService } from './user.service';

const AVATAR_MAX_BYTES = 3 * 1024 * 1024;

// Any signed-in user, as in v1: GET /user is the session bootstrap for customers and admins.
// The PPI writes need a Customer row and answer 403 for admins.
@ApiTags('User')
@Access()
@ApiUserUnauthorizedResponse()
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly ppiService: PPIService,
    private readonly inappService: InappService,
    private readonly notificationStream: NotificationStreamService,
  ) {}

  // The 2FA setup screen needs it before an admin has 2FA on (§0.2 release blocker): never remove.
  @AllowWithoutTwoFactor()
  @Get()
  @ApiOperation({
    summary: 'Get the signed-in user’s profile',
    description:
      'Customers and admins. `role` is CUSTOMER or the admin’s role; `email` is null for phone-only ' +
      'customers; externalId, flagReason and accountOfficer are null for admins.',
  })
  @ApiOkBaseResponse(UserDto)
  @ApiUserNotFoundResponse()
  async getProfile(@CurrentUser() user: AuthUser) {
    const data = await this.userService.getUserById(user.userId, user.role);
    return { message: `Profile data for ${data.name} has been successfully queried`, data };
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get the signed-in user’s in-app notifications (newest first)' })
  @ApiExtraModels(BaseResponseDto, UserNotificationsDto, MetaDto)
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(UserNotificationsDto) },
            meta: { $ref: getSchemaPath(MetaDto) },
          },
        },
      ],
    },
  })
  async getNotifications(@CurrentUser() user: AuthUser, @Query() query: PaginatedQueryDto) {
    const { page = 1, limit = 20 } = query;
    const { notifications, unreadCount, total } = await this.inappService.getUserNotifications(
      user.userId,
      page,
      limit,
    );
    return {
      data: { notifications, unreadCount },
      message: 'Notifications fetched successfully',
      meta: { total, page, limit },
    };
  }

  @Sse('notifications/stream')
  @ApiOperation({
    summary: 'Live notification signal (Server-Sent Events)',
    description:
      'A `text/event-stream` that stays open. A `notifications` event (data `{"changed":true}`) means the ' +
      "signed-in user's notifications changed: one arrived, was read on another tab or device, or was cleared — " +
      'refetch GET /user/notifications. A `ping` event every 25 s keeps the connection alive. Open it with ' +
      '`new EventSource(url, { withCredentials: true })` (the session cookie authenticates it).',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: 'The event stream', content: { 'text/event-stream': {} } })
  streamNotifications(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return this.notificationStream.stream(user.userId);
  }

  @Patch('notifications/mark-read')
  @ApiOperation({ summary: 'Mark all of the signed-in user’s notifications as read' })
  @ApiNullOkResponse('All notifications marked as read', 'All notifications marked as read')
  async markAllNotificationsRead(@CurrentUser() user: AuthUser) {
    await this.inappService.markAllAsRead(user.userId);
    return { data: null, message: 'All notifications marked as read' };
  }

  @Patch('notifications/:id/read')
  @ApiOperation({
    summary: 'Mark one notification as read',
    description: 'A notification that is not the caller’s, or already read, is left alone (still 200).',
  })
  @ApiNullOkResponse('Notification marked as read', 'Notification marked as read')
  async markNotificationRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.inappService.markAsRead(user.userId, id);
    return { data: null, message: 'Notification marked as read' };
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Upload a new avatar (image, at most 3 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
    description: 'Field `file`: an image',
  })
  @ApiCreatedResponse({
    description: 'Avatar uploaded; User.image now points at it',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        { properties: { data: { $ref: getSchemaPath(UserAvatarDto) } } },
      ],
    },
  })
  @ApiExtraModels(BaseResponseDto, UserAvatarDto)
  @ApiGenericErrorResponse({
    msg: 'Only image files can be used as an avatar',
    code: 400,
    err: 'Bad Request',
    desc: 'Not an image, or no file sent ("Choose an image to upload")',
  })
  @ApiGenericErrorResponse({
    msg: 'File too large',
    code: 413,
    err: 'Payload Too Large',
    desc: 'The image is larger than 3 MB',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: AVATAR_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new BadRequestException('Only image files can be used as an avatar'), false);
      },
    }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthUser) {
    return this.userService.uploadAvatar(file, user.userId);
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Dashboard overview',
    description:
      'The live loan with its ledger figures, repayment rate, pending requests, the last repayment ' +
      'and the deduction payroll will be asked for next.',
  })
  @ApiOkBaseResponse(UserOverviewDto)
  async getOverview(@CurrentUser() user: AuthUser) {
    const data = await this.userService.getOverview(user.userId);
    return { data, message: 'User loans overview successfully queried' };
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Recent activity feed (newest first, at most 20 items)' })
  @ApiExtraModels(UserRecentActivityDto)
  @ApiOkResponse({
    schema: {
      properties: {
        data: { type: 'array', items: { $ref: getSchemaPath(UserRecentActivityDto) } },
        message: { type: 'string', example: 'User activity successfully queried' },
      },
    },
  })
  async getRecentActivity(@CurrentUser() user: AuthUser) {
    const data = await this.userService.getRecentActivities(user.userId);
    return { data, message: 'User activity successfully queried' };
  }

  @Get('identity')
  @ApiOperation({ summary: 'Get the signed-in customer’s identity details (null if none)' })
  @ApiOkBaseResponse(UserIdentityDto)
  async getUserIdentityInfo(@CurrentUser() user: AuthUser) {
    const data = await this.userService.getIdentityInfo(user.userId);
    return {
      message: data
        ? 'Identity information for the user has been retrieved successfully'
        : 'Identity information not found for this user',
      data,
    };
  }

  @Get('payroll')
  @ApiOperation({ summary: 'Get the signed-in customer’s payroll details (null if none)' })
  @ApiOkBaseResponse(UserPayrollDto)
  async getPayroll(@CurrentUser() user: AuthUser) {
    return this.userService.getPayroll(user.userId);
  }

  @Get('payment-method')
  @ApiOperation({ summary: 'Get the signed-in customer’s bank account (null if none)' })
  @ApiOkBaseResponse(UserPaymentMethodDto)
  async getUserPaymentMethod(@CurrentUser() user: AuthUser) {
    const data = await this.userService.getPaymentMethod(user.userId);
    return { data, message: data ? 'Payment methods have been successfully queried' : 'No payment method found' };
  }

  @Post('payment-method')
  @ApiOperation({
    summary: 'Add a bank account',
    description: 'Puts the account under review (FLAGGED).',
  })
  @ApiNullOkResponse('Payment method saved', 'Payment method has been successfully created and added!', true)
  @ApiDtoErrorResponse('Account number must be 10 digits')
  @ApiCustomerOnlyResponse()
  @ApiGenericErrorResponse({
    msg: ACCOUNT_NUMBER_TAKEN,
    code: 409,
    err: 'Conflict',
    desc: `A payment method already exists ("A payment method already exists for this user."), or the account number / BVN belongs to another customer ("${BVN_TAKEN}")`,
  })
  async createUserPaymentMethod(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentMethodDto) {
    const message = await this.ppiService.addPaymentMethod(user.userId, dto);
    return { message, data: null };
  }

  @Patch('payment-method')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Ask to change the bank account',
    description:
      'Nothing changes yet: the new details wait for an admin (a PAYMENT_METHOD change request, folded into ' +
      `any pending one). 202 { data: ChangeRequest, message: "${CHANGE_SUBMITTED}" }; data is null when ` +
      'nothing differs from the live details.',
  })
  @ApiOkBaseResponse(ChangeRequestDto)
  @ApiCustomerOnlyResponse()
  @ApiGenericErrorResponse({
    msg: 'No existing payment method found to update.',
    code: 404,
    err: 'Not Found',
    desc: 'No bank account yet: add one first',
  })
  @ApiGenericErrorResponse({
    msg: BVN_TAKEN,
    code: 409,
    err: 'Conflict',
    desc: `The account number ("${ACCOUNT_NUMBER_TAKEN}") or BVN belongs to another customer`,
  })
  async updateUserPaymentMethod(@CurrentUser() user: AuthUser, @Body() dto: UpdatePaymentMethodDto) {
    return this.ppiService.updatePaymentMethod(user.userId, dto);
  }

  @Post('identity')
  @ApiOperation({
    summary: 'Submit identity details for the first time',
    description: 'Puts the account under review (FLAGGED).',
  })
  @ApiBody({ type: CreateIdentityDto })
  @ApiNullOkResponse(
    'Identity details saved',
    'Your identity documents have been successfully created! Please wait as we manually review this information',
    true,
  )
  @ApiCustomerOnlyResponse()
  @ApiGenericErrorResponse({
    msg: 'You have already submitted your identity verification.',
    code: 400,
    err: 'Bad Request',
    desc: 'Identity details already exist: update them instead',
  })
  async submitVerification(@CurrentUser() user: AuthUser, @Body() dto: CreateIdentityDto) {
    const message = await this.ppiService.submitVerification(user.userId, dto);
    return { message, data: null };
  }

  @Patch('identity')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Ask to change identity details',
    description:
      'Nothing changes yet: the new details wait for an admin (an IDENTITY change request, folded into any ' +
      'pending one). data is null when nothing differs from the live details.',
  })
  @ApiBody({ type: UpdateIdentityDto })
  @ApiOkBaseResponse(ChangeRequestDto)
  @ApiCustomerOnlyResponse()
  @ApiGenericErrorResponse({
    msg: 'Identity record not found. Please submit your verification first.',
    code: 404,
    err: 'Not Found',
    desc: 'No identity details yet: submit them first',
  })
  async updateVerification(@CurrentUser() user: AuthUser, @Body() dto: UpdateIdentityDto) {
    return this.ppiService.updateVerification(user.userId, dto);
  }
}
