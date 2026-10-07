import { applyDecorators, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { Access, CurrentUser } from 'src/auth/decorators';
import { ApiRoleForbiddenResponse } from 'src/admin/common/decorators';
import { CashLoanQueryDto, CommodityLoanQueryDto, TopupQueryDto } from 'src/admin/common/dto/loan.dto';
import { FilterDeductionsDto } from 'src/admin/common/dto/repayment.dto';
import { CashLoanDto, CommodityLoanDto, TopupItemDto } from 'src/admin/common/entities/loan.entities';
import { DeductionListItemDto } from 'src/admin/common/entities/repayment.entity';
import {
  ApiDtoErrorResponse,
  ApiGenericErrorResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import { BaseResponseDto } from 'src/common/dto/generic.dto';
import type { AuthUser } from 'src/common/types';
import {
  EscalateDto,
  EscalationResultDto,
  MarketerAdminDto,
  MarketerAssetRequestItemDto,
  MarketerCashLoanItemDto,
  MarketerOverviewDto,
  MarketerRepaymentOverviewDto,
  MarketerRepaymentsQueryDto,
  MarketerTopupItemDto,
} from './marketer.dto';
import { ASSET_REQUEST_NOT_FOUND, LOAN_NOT_FOUND, MarketerService, TOPUP_NOT_FOUND } from './marketer.service';

/** `{ data: Model[], message }`. */
function ApiOkArrayResponse(model: Type<unknown>) {
  return applyDecorators(
    ApiExtraModels(BaseResponseDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseDto) },
          { properties: { data: { type: 'array', items: { $ref: getSchemaPath(model) } } } },
        ],
      },
    }),
  );
}

const notFound = (msg: string) => ApiGenericErrorResponse({ code: 404, err: 'Not Found', msg, desc: 'Not one of your customers’' });

// A marketer's own work. Every list and item is limited to the customers they onboarded (their account officer is
// the marketer); anything else is a 404. Marketers read and escalate: deciding and disbursing stay with admins.
@ApiTags('Marketer')
@Access('MARKETER')
@Controller('marketer')
export class MarketerController {
  constructor(private readonly service: MarketerService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'What waits on an admin',
    description:
      'Your customers awaiting activation, their loans, asset requests and top-ups awaiting a decision or disbursement, ' +
      'and organizations you added that await approval: oldest first, with when you last escalated each.',
  })
  @ApiOkBaseResponse(MarketerOverviewDto)
  @ApiRoleForbiddenResponse()
  async overview(@CurrentUser() user: AuthUser) {
    return { data: await this.service.overview(user.userId), message: 'What waits on an admin' };
  }

  @Get('loans')
  @ApiOperation({ summary: "Your customers' cash loans", description: 'As GET /admin/loans/cash, plus the escalation state' })
  @ApiOkPaginatedResponse(MarketerCashLoanItemDto)
  @ApiRoleForbiddenResponse()
  loans(@CurrentUser() user: AuthUser, @Query() query: CashLoanQueryDto) {
    return this.service.cashLoanList(user.userId, query);
  }

  @Get('loans/:id')
  @ApiOperation({ summary: 'One of your customers’ loans (cash or asset)' })
  @ApiOkBaseResponse(CashLoanDto)
  @notFound(LOAN_NOT_FOUND)
  @ApiRoleForbiddenResponse()
  async loan(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return { data: await this.service.loan(user.userId, id), message: 'Loan details' };
  }

  @Get('asset-requests')
  @ApiOperation({
    summary: "Your customers' asset requests",
    description: 'As GET /admin/loans/commodity, plus the escalation state',
  })
  @ApiOkPaginatedResponse(MarketerAssetRequestItemDto)
  @ApiRoleForbiddenResponse()
  assetRequests(@CurrentUser() user: AuthUser, @Query() query: CommodityLoanQueryDto) {
    return this.service.assetRequestList(user.userId, query);
  }

  @Get('asset-requests/:id')
  @ApiOperation({ summary: 'One of your customers’ asset requests (without the admins-only private details)' })
  @ApiOkBaseResponse(CommodityLoanDto)
  @notFound(ASSET_REQUEST_NOT_FOUND)
  @ApiRoleForbiddenResponse()
  async assetRequest(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return { data: await this.service.assetRequest(user.userId, id), message: 'Asset request details' };
  }

  @Get('topups')
  @ApiOperation({ summary: "Your customers' top-ups", description: 'As GET /admin/loans/topups, plus the escalation state' })
  @ApiOkPaginatedResponse(MarketerTopupItemDto)
  @ApiRoleForbiddenResponse()
  topups(@CurrentUser() user: AuthUser, @Query() query: TopupQueryDto) {
    return this.service.topupList(user.userId, query);
  }

  @Get('topups/:id')
  @ApiOperation({ summary: 'One of your customers’ top-ups' })
  @ApiOkBaseResponse(TopupItemDto)
  @notFound(TOPUP_NOT_FOUND)
  @ApiRoleForbiddenResponse()
  async topup(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return { data: await this.service.topup(user.userId, id), message: 'Top-up details' };
  }

  @Get('repayments/overview')
  @ApiOperation({
    summary: "One payroll month of your customers' deductions",
    description: 'Expected, collected and deductions by status; `period` defaults to the latest month with deductions',
  })
  @ApiOkBaseResponse(MarketerRepaymentOverviewDto)
  @ApiRoleForbiddenResponse()
  async repaymentOverview(@CurrentUser() user: AuthUser, @Query() query: MarketerRepaymentsQueryDto) {
    return { data: await this.service.repaymentOverview(user.userId, query.period), message: 'Repayments overview' };
  }

  @Get('repayments/deductions')
  @ApiOperation({ summary: "Your customers' deductions", description: 'As GET /admin/repayments/deductions' })
  @ApiOkPaginatedResponse(DeductionListItemDto)
  @ApiDtoErrorResponse('`from` must not be after `to`')
  @ApiRoleForbiddenResponse()
  async deductions(@CurrentUser() user: AuthUser, @Query() query: FilterDeductionsDto) {
    const { rows, total } = await this.service.listDeductions(user.userId, query);
    return {
      data: rows,
      meta: { total, page: query.page ?? 1, limit: query.limit ?? 20 },
      message: 'Deductions fetched successfully',
    };
  }

  @Get('admins')
  @ApiOperation({ summary: 'Admins and super admins you can escalate to' })
  @ApiOkArrayResponse(MarketerAdminDto)
  @ApiRoleForbiddenResponse()
  async admins() {
    return { data: await this.service.admins(), message: 'Admins' };
  }

  @Post('escalations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ask an admin to look at a loan, asset request or top-up',
    description:
      'In-app and by email, to `adminId` or (without it) everyone who can act on it now: any admin while it waits for a ' +
      'decision, super admins once it waits for disbursement. Each admin is asked at most once a day about the same ' +
      'item at the same stage (they are skipped; 409 when everyone was).',
  })
  @ApiOkBaseResponse(EscalationResultDto)
  @ApiDtoErrorResponse('Only a super admin can disburse: ask a super admin, or ask everyone')
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    msg: 'You already asked everyone about this in the last 24 hours',
    desc: 'Already decided, or everyone was asked in the last day',
  })
  @ApiRoleForbiddenResponse()
  async escalate(@CurrentUser() user: AuthUser, @Body() dto: EscalateDto) {
    const data = await this.service.escalate(user, dto);
    return { data, message: `Sent to ${data.sentTo.join(', ')}` };
  }
}
