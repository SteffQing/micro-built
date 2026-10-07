import { Controller, Get, Query } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { Access } from 'src/auth/decorators';
import { ApiGenericErrorResponse, ApiOkBaseResponse } from 'src/common/decorators';
import { BaseResponseDto, PeriodRangeQueryDto } from 'src/common/dto';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { CustomersOverviewDto } from '../common/entities/customers.entities';
import {
  DashboardDisbursementMonthDto,
  DashboardOpenLoanRequestsDto,
  DashboardOperationsDto,
  DashboardOverviewDto,
  LoanReportOverviewDto,
  LoanReportStatusDistributionDto,
} from '../common/entities/dashboard.entities';
import { CustomersService } from '../customers/customers.service';
import { CHART_MAX_MONTHS, DashboardService } from './dashboard.service';

const RANGE_DESCRIPTION =
  '`from`/`to` are payroll months (YYYY-MM, inclusive, both optional; absent = all-time). Booked figures count ' +
  'microloans disbursed inside the Lagos bounds of the range; collected figures count payments of the payroll ' +
  'months in the range. Counts and `outstanding` are always as of now.';

/** 400 for a bad range: one response per status code, so every cause goes in its description. */
function ApiRangeErrors(...extra: string[]) {
  return ApiGenericErrorResponse({
    desc: ['`from`/`to` is not YYYY-MM', '`from` is after `to`', ...extra].join('; '),
    code: 400,
    err: 'Bad Request',
    msg: '`from` must not be after `to`',
  });
}

@ApiTags('Admin Dashboard')
@Access('SUPER_ADMIN', 'ADMIN')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly customersService: CustomersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Dashboard overview metrics', description: RANGE_DESCRIPTION })
  @ApiOkBaseResponse(DashboardOverviewDto)
  @ApiRangeErrors()
  @ApiRoleForbiddenResponse()
  async getOverview(@Query() query: PeriodRangeQueryDto) {
    const data = await this.dashboardService.overview(query);
    return { data, message: 'Dashboard overview fetched successfully' };
  }

  @Get('operations')
  @ApiOperation({
    summary: 'Operational pulse',
    description:
      'The latest voucher (any organization), where each organization’s payroll stands (latest locked month, ' +
      'months waiting for a voucher, next month to generate), current rates (percent), items waiting on an admin, ' +
      'the 5 most recently disbursed loans and the 5 newest customers.',
  })
  @ApiOkBaseResponse(DashboardOperationsDto)
  @ApiRoleForbiddenResponse()
  async getOperations() {
    const data = await this.dashboardService.operations();
    return { data, message: 'Dashboard operations fetched successfully' };
  }

  @Get('disbursement-chart')
  @ApiOperation({
    summary: 'Principal disbursed per month and loan category',
    description:
      'New loans and top-ups disbursed, per Lagos calendar month of `from..to` (YYYY-MM; default: January of ' +
      `the current year to the current month; at most ${CHART_MAX_MONTHS} months). One entry per month, oldest first.`,
  })
  @ApiExtraModels(BaseResponseDto, DashboardDisbursementMonthDto)
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        { properties: { data: { type: 'array', items: { $ref: getSchemaPath(DashboardDisbursementMonthDto) } } } },
      ],
    },
  })
  @ApiRangeErrors(`more than ${CHART_MAX_MONTHS} months ("Pick at most ${CHART_MAX_MONTHS} months for the chart")`)
  @ApiRoleForbiddenResponse()
  async getDisbursementChart(@Query() query: PeriodRangeQueryDto) {
    const data = await this.dashboardService.disbursementChart(query);
    return { data, message: 'Disbursement chart data fetched successfully' };
  }

  @Get('open-loan-requests')
  @ApiOperation({
    summary: 'Newest open requests',
    description: 'The 5 newest PENDING cash loan requests, PENDING top-ups and asset requests IN_REVIEW.',
  })
  @ApiOkBaseResponse(DashboardOpenLoanRequestsDto)
  @ApiRoleForbiddenResponse()
  async getOpenLoanRequests() {
    const data = await this.dashboardService.openLoanRequests();
    return { data, message: 'Open loan requests fetched successfully' };
  }

  @Get('customers-overview')
  @ApiOperation({ summary: 'Customer metrics' })
  @ApiOkBaseResponse(CustomersOverviewDto)
  @ApiRoleForbiddenResponse()
  async getCustomersOverview() {
    const data = await this.customersService.getOverview();
    return { data, message: 'Customers overview fetched successfully' };
  }

  @Get('status-distribution')
  @ApiOperation({ summary: 'Loan count by status' })
  @ApiOkBaseResponse(LoanReportStatusDistributionDto)
  @ApiRoleForbiddenResponse()
  async getLoanStatusDistribution() {
    const data = await this.dashboardService.statusDistribution();
    return { data, message: 'Loan status distribution fetched' };
  }

  @Get('loan-report-overview')
  @ApiOperation({ summary: 'Loan report overview', description: RANGE_DESCRIPTION })
  @ApiOkBaseResponse(LoanReportOverviewDto)
  @ApiRangeErrors()
  @ApiRoleForbiddenResponse()
  async getLoanReportOverview(@Query() query: PeriodRangeQueryDto) {
    const data = await this.dashboardService.loanReportOverview(query);
    return { data, message: 'Queried loan report overview successfully' };
  }
}
