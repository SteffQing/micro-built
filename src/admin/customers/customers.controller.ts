import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBadRequestResponse,
  ApiCreatedResponse,
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
  FilterLiquidationRequestsDto,
  GenerateCustomerLoanReportDto,
} from '../common/dto';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { RepaymentsService } from 'src/user/repayments/repayments.service';
import { RepaymentsService as AdminRepaymentService } from '../repayments/repayments.service';
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
  CustomerLiquidationRequestsDto,
  ActiveLoanDto,
} from '../common/entities';
import {
  ApiNullOkResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import { UserService } from 'src/user/user.service';
import { Request } from 'express';
import { AuthUser } from 'src/common/types';
import { LoanService } from 'src/user/loan/loan.service';

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
  @Roles('ADMIN', 'SUPER_ADMIN', 'MARKETER')
  @ApiOperation({ summary: 'Onboard a new customer' })
  @ApiCreatedResponse({ description: 'Customer successfully onboarded' })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  @ApiRoleForbiddenResponse()
  async addCustomer(@Req() req: Request, @Body() dto: OnboardCustomer) {
    const { userId: adminId, role } = req.user as AuthUser;
    const result = await this.customersService.addCustomer(dto, adminId, role);
    return result;
  }

  @Get('account-officers/:id')
  @ApiOperation({
    summary: 'Get customers assigned to a specific account officer',
  })
  @ApiOkPaginatedResponse(CustomerListItemDto)
  @ApiRoleForbiddenResponse()
  async getCustomersByAccountOfficerId(
    @Param('id') id: string,
    @Query() query: CustomersQueryDto,
  ) {
    const customers = await this.customersService.getAccountOfficerCustomers(
      id,
      query,
    );
    return {
      ...customers,
      message:
        'Customers attached to the specified account officer has been queried successfully',
    };
  }

  @Get('account-officers/unassigned')
  @ApiOperation({
    summary:
      'Get customers without an assigned account officer (online registrations)',
  })
  @ApiOkPaginatedResponse(CustomerListItemDto)
  @ApiRoleForbiddenResponse()
  async getOnlineRegistrationCustomers(@Query() query: CustomersQueryDto) {
    const customers = await this.customersService.getAccountOfficerCustomers(
      null,
      query,
    );
    return {
      ...customers,
      message: 'Customers signed up via portal queried successfully',
    };
  }

  @Get('account_officer/me')
  @Roles('ADMIN', 'SUPER_ADMIN', 'MARKETER')
  @ApiOperation({
    summary: 'Get customers assigned to the current logged-in admin',
  })
  @ApiOkPaginatedResponse(CustomerListItemDto)
  @ApiRoleForbiddenResponse()
  async getAccountOfficerCustomers(
    @Req() req: Request,
    @Query() query: CustomersQueryDto,
  ) {
    const { userId: adminId } = req.user as AuthUser;
    const customers = await this.customersService.getAccountOfficerCustomers(
      adminId,
      query,
    );
    return {
      ...customers,
      message:
        'Customers assigned to the current logged-in admin has been queried successfully',
    };
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
    private readonly adminRepaymentService: AdminRepaymentService,
    private readonly customerLoanService: LoanService,
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

  @Post(':id/request-liquidation')
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
    @Req() req: Request,
    @Param('id') userId: string,
    @Body() dto: CreateLiquidationRequestDto,
  ) {
    const { userId: adminId } = req.user as AuthUser;
    return this.adminRepaymentService.liquidationRequest(userId, adminId, dto);
  }

  @Get(':id/liquidation-requests')
  @ApiOperation({
    summary: 'Get all liquidation Requests for a customer',
    description:
      'Returns a paginated list of all liquidation Requests for a customer filtered by query parameters.',
  })
  @ApiOkPaginatedResponse(CustomerLiquidationRequestsDto)
  @ApiRoleForbiddenResponse()
  getRepayments(
    @Param('id') userId: string,
    @Query() dto: FilterLiquidationRequestsDto,
  ) {
    return this.adminRepaymentService.getCustomerLiquidationRequests(
      userId,
      dto,
    );
  }

  @Post(':id/generate-report')
  @ApiOperation({ summary: 'Generate a customer loan report' })
  @ApiParam({ name: 'id', description: 'User ID', example: 'MB-HOWP2' })
  @ApiBody({
    type: GenerateCustomerLoanReportDto,
    description: 'Email to send the report to',
  })
  @ApiNullOkResponse(
    'Report generated successfully',
    'Customer loan report has been queued for processing and will be sent to the provided email',
  )
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  @ApiRoleForbiddenResponse()
  generateReport(
    @Param('id') userId: string,
    @Body() dto: GenerateCustomerLoanReportDto,
  ) {
    return this.customerService.generateLoanReport(userId, dto.email);
  }

  @Get(':id/active-loan')
  @ApiOperation({
    summary: 'Get active loan for a customer',
    description:
      'Returns the active loan for a customer, if there is else null',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: 'MB-HOWP2' })
  @ApiOkBaseResponse(ActiveLoanDto)
  @ApiRoleForbiddenResponse()
  getActiveLoan(@Param('id') userId: string) {
    return this.customerLoanService.getUserActiveLoan(userId);
  }
}
