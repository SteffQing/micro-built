import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { endOfDay, isValid, startOfDay } from 'date-fns';
import { DashboardService, DateRange } from './dashboard.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import {
  CustomersOverviewDto,
  DashboardOverviewResponseDto,
  DisbursementChartResponseDto,
  LoanReportOverviewDto,
  LoanReportStatusDistributionDto,
  OpenLoanRequestsResponseDto,
} from '../common/entities';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { CustomersService } from '../customers/customers.service';
import { ApiOkBaseResponse } from 'src/common/decorators';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly customersService: CustomersService,
  ) {}

  // ponytail: from/to are optional date-only strings (YYYY-MM-DD). Both required for a
  // range; anything invalid falls back to all-time. `to` covers the whole day.
  private parseRange(from?: string, to?: string): DateRange | undefined {
    if (!from || !to) return undefined;
    const f = new Date(from);
    const t = new Date(to);
    if (!isValid(f) || !isValid(t)) return undefined;
    return { from: startOfDay(f), to: endOfDay(t) };
  }

  @Get()
  @ApiOperation({ summary: 'Get dashboard overview metrics' })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2026-01-01' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2026-01-31' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview data retrieved successfully',
    type: DashboardOverviewResponseDto,
  })
  @ApiRoleForbiddenResponse()
  async getOverview(@Query('from') from?: string, @Query('to') to?: string) {
    const data = await this.dashboardService.overview(this.parseRange(from, to));
    return { message: 'Dashboard overview fetched successfully', data };
  }

  @Get('disbursement-chart')
  @ApiOperation({
    summary: 'Get loan disbursement chart data grouped by month and category',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year to filter disbursements, defaults to current year',
  })
  @ApiResponse({
    status: 200,
    description: 'Disbursement chart data retrieved successfully',
    type: DisbursementChartResponseDto,
  })
  @ApiRoleForbiddenResponse()
  async getDisbursementChart(@Query('year') year?: number) {
    const data = await this.dashboardService.getDisbursementChartData(year);
    return { message: 'Disbursement chart data fetched successfully', data };
  }

  @Get('open-loan-requests')
  @ApiOperation({
    summary:
      'Get 5 most recent open loan requests for cash and commodity loans',
  })
  @ApiResponse({
    status: 200,
    description: 'Open loan requests retrieved successfully',
    type: OpenLoanRequestsResponseDto,
  })
  @ApiRoleForbiddenResponse()
  async getOpenLoanRequests() {
    const data = await this.dashboardService.getOpenLoanRequests();
    return { message: 'Open loan requests fetched successfully', data };
  }

  @Get('customers-overview')
  @ApiOperation({ summary: 'Get overview of customer metrics' })
  @ApiOkBaseResponse(CustomersOverviewDto)
  @ApiRoleForbiddenResponse()
  async getCustomersOverview() {
    const data = await this.customersService.getOverview();
    return {
      data,
      message: 'Customers overview fetched successfully',
    };
  }

  @Get('status-distribution')
  @ApiOperation({ summary: 'Get loan count by status' })
  @ApiOkBaseResponse(LoanReportStatusDistributionDto)
  @ApiRoleForbiddenResponse()
  async getLoanStatusDistribution() {
    const data = await this.dashboardService.getLoanStatusDistro();
    return {
      data: { statusCounts: data },
      message: 'Loan status distribution fetched',
    };
  }

  @Get('loan-report-overview')
  @ApiOperation({ summary: 'Get loan report overview' })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2026-01-01' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2026-01-31' })
  @ApiOkBaseResponse(LoanReportOverviewDto)
  @ApiRoleForbiddenResponse()
  async getLoanReportOverview(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.dashboardService.loanReportOverview(
      this.parseRange(from, to),
    );
    return { data: data, message: 'Queried loan report overview successfully' };
  }
}
