import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CustomerService, CustomersService } from './customers.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { CustomersQueryDto, CustomerQueryDto } from '../common/dto';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { RepaymentsService } from 'src/user/repayments/repayments.service';
import { RepaymentStatus } from '@prisma/client';
import { RepaymentHistoryItem } from 'src/user/common/entities';
import {
  CustomerListItemDto,
  CustomersOverviewDto,
  UserLoansDto,
  UserLoanSummaryDto,
  CustomerInfoDto,
} from '../common/entities';
import {
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';

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
    return this.customerService.getUserLoanSummaryAndPayrollInfo(id);
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
}
