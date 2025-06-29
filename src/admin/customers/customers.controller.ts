import {
  Controller,
  Get,
  ParseUUIDPipe,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { CustomerService, CustomersService } from './customers.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import {
  CustomersQueryDto,
  CustomersResponseDto,
  CustomersOverviewDto,
  CustomerInfoResponseDto,
  UserLoansResponseDto,
  UserLoanSummaryDto,
  CustomerQueryDto,
} from '../common/dto';
import { ResponseDto } from 'src/common/dto';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { RepaymentsService } from 'src/user/repayments/repayments.service';
import { RepaymentStatus } from '@prisma/client';
import { RepaymentHistoryResponseDto } from 'src/user/common/dto';

@ApiTags('Customers Page')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get overview of customer metrics' })
  @ApiOkResponse({
    type: ResponseDto<CustomersOverviewDto>,
    description: 'Customer overview metrics returned successfully',
  })
  @ApiRoleForbiddenResponse()
  async getOverview(): Promise<ResponseDto<CustomersOverviewDto>> {
    const data = await this.customersService.getOverview();
    return {
      data,
      message: 'Customers overview fetched successfully',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of customers' })
  @ApiOkResponse({
    type: CustomersResponseDto,
    description: 'Paginated list of customers returned successfully',
  })
  @ApiRoleForbiddenResponse()
  async getCustomers(@Query() query: CustomersQueryDto) {
    return this.customersService.getCustomers(query);
  }
}

@ApiTags('Customer Page')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/customer')
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly userRepaymentService: RepaymentsService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile info by user ID' })
  @ApiParam({ name: 'id', description: 'User ID', example: 'a1b2c3d4-5678' })
  @ApiResponse({
    status: 200,
    description: 'User has been successfully queried',
    type: CustomerInfoResponseDto,
  })
  @ApiRoleForbiddenResponse()
  async getUserInfo(@Param('id', ParseUUIDPipe) id: string) {
    return this.customerService.getUserInfo(id);
  }

  @Get(':id/loans')
  @ApiOperation({ summary: 'Get user active and pending loans' })
  @ApiResponse({
    status: 200,
    description:
      "User's active and pending loans have been successfully queried",
    type: UserLoansResponseDto,
  })
  @ApiRoleForbiddenResponse()
  async getUserLoans(@Param('id', ParseUUIDPipe) id: string) {
    return this.customerService.getUserActiveAndPendingLoans(id);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Get user loan summary and repayment flags' })
  @ApiResponse({
    status: 200,
    description: "User's loan summary has been successfully retrieved",
    type: ResponseDto<UserLoanSummaryDto>,
  })
  @ApiRoleForbiddenResponse()
  async getUserLoanSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.customerService.getUserLoanSummaryAndPayrollInfo(id);
  }

  @Get(':id/repayments')
  @ApiOperation({ summary: 'Get repayment history for user' })
  @ApiOkResponse({
    type: RepaymentHistoryResponseDto,
    description: "paginated return of user's repayment history",
  })
  @ApiQuery({ name: 'status', enum: RepaymentStatus, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiRoleForbiddenResponse()
  async getCustomers(
    @Query() query: CustomerQueryDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.userRepaymentService.getRepaymentHistory(
      id,
      query.limit,
      query.page,
      query.status,
    );
  }
}
