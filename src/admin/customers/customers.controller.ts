import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { CustomerService, CustomersService } from './customers.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import {
  CustomersQueryDto,
  CustomerQueryDto,
  OnboardCustomer,
  UpdateCustomerStatusDto,
  SendMessageDto,
  CreateLiquidationRequestDto,
} from '../common/dto';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { RepaymentsService } from 'src/user/repayments/repayments.service';
import { RepaymentStatus } from '@prisma/client';
import {
  RepaymentHistoryItem,
  UserIdentityDto,
  UserPaymentMethodDto,
  UserPayrollDto,
} from 'src/user/common/entities';
import {
  CustomerListItemDto,
  CustomersOverviewDto,
  UserLoansDto,
  UserLoanSummaryDto,
  CustomerInfoDto,
  CustomerPPIDto,
} from '../common/entities';
import {
  ApiNullOkResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from 'src/user/user.service';

@ApiTags('Admin:Customers Page')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get overview of customer metrics' })
  @ApiOkBaseResponse(CustomersOverviewDto)
  @ApiRoleForbiddenResponse()
  async getOverview() {
    const data = await this.customersService.getOverview();
    return {
      data,
      message: 'Customers overview fetched successfully',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of customers' })
  @ApiOkPaginatedResponse(CustomerListItemDto)
  @ApiRoleForbiddenResponse()
  async getCustomers(@Query() query: CustomersQueryDto) {
    return this.customersService.getCustomers(query);
  }

  @Post()
  @ApiOperation({ summary: 'Onboard a new customer' })
  @ApiCreatedResponse({ description: 'Customer successfully onboarded' })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  @ApiRoleForbiddenResponse()
  async addCustomer(@Body() dto: OnboardCustomer) {
    const result = await this.customersService.addCustomer(dto);
    return result;
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a document for identity verification' })
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
  })
  @ApiCreatedResponse({
    description: 'File uploaded successfully',
    schema: {
      example: {
        message: 'passport.pdf has been successfully uploaded!',
        data: {
          url: 'https://xyz.supabase.co/storage/identity-bucket/2025-06-08/passport.pdf',
        },
      },
    },
  })
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
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Invalid file type'), false);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.customersService.uploadFile(file);
  }
}

@ApiTags('Admin:Customer Page')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/customer')
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly userRepaymentService: RepaymentsService,
    private readonly userService: UserService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile info by user ID' })
  @ApiParam({ name: 'id', description: 'User ID', example: 'MB-HOWP2' })
  @ApiOkBaseResponse(CustomerInfoDto)
  @ApiRoleForbiddenResponse()
  async getUserInfo(@Param('id') id: string) {
    return this.customerService.getUserInfo(id);
  }

  @Get(':id/loans')
  @ApiOperation({ summary: 'Get user active and pending loans' })
  @ApiOkBaseResponse(UserLoansDto)
  @ApiRoleForbiddenResponse()
  async getUserLoans(@Param('id') id: string) {
    return this.customerService.getUserActiveAndPendingLoans(id);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Get user loan summary and repayment flags' })
  @ApiOkBaseResponse(UserLoanSummaryDto)
  @ApiRoleForbiddenResponse()
  async getUserLoanSummary(@Param('id') id: string) {
    return this.customerService.getUserLoanSummary(id);
  }

  @Get(':id/repayments')
  @ApiOperation({ summary: 'Get repayment history for user' })
  @ApiOkPaginatedResponse(RepaymentHistoryItem)
  @ApiQuery({ name: 'status', enum: RepaymentStatus, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiRoleForbiddenResponse()
  async getCustomers(
    @Query() query: CustomerQueryDto,
    @Param('id') id: string,
  ) {
    const data = await this.userRepaymentService.getRepaymentHistory(
      id,
      query.limit,
      query.page,
      query.status,
    );
    return {
      data,
      message: 'Repayment history fetched successfully',
    };
  }

  @Get(':id/ppi-info')
  @ApiOperation({ summary: 'Get user info by user ID' })
  @ApiParam({ name: 'id', description: 'User ID', example: 'MB-HOWP2' })
  @ApiOkBaseResponse(CustomerPPIDto)
  @ApiRoleForbiddenResponse()
  async getCustomerPPIInfo(@Param('id') id: string) {
    return this.customerService.getUserPayrollPaymentMethodAndIdentityInfo(id);
  }

  @Get(':id/payment-method')
  @ApiOperation({ summary: 'Get user payment method by user ID' })
  @ApiParam({ name: 'id', description: 'User ID', example: 'MB-HOWP2' })
  @ApiOkBaseResponse(UserPaymentMethodDto)
  @ApiRoleForbiddenResponse()
  async getCustomerPaymentMethod(@Param('id') id: string) {
    const data = await this.userService.getPaymentMethod(id);
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
  @Get(':id/identity')
  @ApiOperation({
    summary:
      'Get the customers identity information and submitted sign up form',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: 'MB-HOWP2' })
  @ApiOkBaseResponse(UserIdentityDto)
  @ApiRoleForbiddenResponse()
  async getUserIdentityInfo(@Param('id') id: string) {
    const identityInfo = await this.userService.getIdentityInfo(id);
    return {
      message: identityInfo
        ? 'Identity information for the user has been retrieved successfully'
        : 'Identity information not found for this user',
      data: identityInfo,
    };
  }

  @Get(':id/payroll')
  @ApiOperation({ summary: 'Get customer payroll data' })
  @ApiParam({ name: 'id', description: 'User ID', example: 'MB-HOWP2' })
  @ApiOkBaseResponse(UserPayrollDto)
  @ApiRoleForbiddenResponse()
  async getPayroll(@Param('id') id: string) {
    return this.userService.getPayroll(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update the status of a user' })
  @ApiNullOkResponse(
    'User status updated successfully',
    'John Doe has been flagged!',
  )
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid status or transition not allowed',
  })
  async updateStatus(
    @Param('id') userId: string,
    @Body() dto: UpdateCustomerStatusDto,
  ) {
    return this.customerService.updateCustomerStatus(userId, dto.status);
  }

  @Post(':id/message')
  @ApiOperation({ summary: 'Send a message to a user (in-app)' })
  @ApiParam({ name: 'id', description: 'The ID of the user to message' })
  @ApiNullOkResponse(
    'Message sent successfully',
    'Message sent to John Doe successfully',
    true,
  )
  @ApiResponse({ status: 404, description: 'User not found' })
  async sendMessage(@Param('id') userId: string, @Body() dto: SendMessageDto) {
    return this.customerService.messageUser(userId, dto);
  }

  @Post(':id/liquidation-request')
  @ApiOperation({ summary: 'Create a liquidation request for a user' })
  @ApiParam({
    name: 'id',
    description: 'ID of the user for the liquidation request',
  })
  @ApiNullOkResponse(
    'Liquidation request created successfully',
    'Liquidation request for John Doe is submitted successfully',
    true,
  )
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async createLiquidationRequest(
    @Param('id') userId: string,
    @Body() dto: CreateLiquidationRequestDto,
  ) {
    return this.customerService.liquidationRequest(userId, dto);
  }
}
