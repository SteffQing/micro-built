import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
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
  DashboardOverviewResponseDto,
  DisbursementChartResponseDto,
  OpenLoanRequestsResponseDto,
} from '../common/dto';
import { ApiRoleForbiddenResponse } from '../common/decorators';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard overview metrics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview data retrieved successfully',
    type: DashboardOverviewResponseDto,
  })
  @ApiRoleForbiddenResponse()
  async getOverview() {
    const data = await this.dashboardService.overview();
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
    summary: 'Get open loan requests for cash and commodity loans',
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
}
