import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Access, CurrentUser } from 'src/auth/decorators';
import {
  ApiDtoErrorResponse,
  ApiGenericErrorResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';
import type { AuthUser } from 'src/common/types';
import { ApiUserUnauthorizedResponse } from '../common/decorators/auth-user';
import { UserRepaymentsQueryDto } from '../common/dto/repayments.dto';
import { UserRepaymentDto, UserRepaymentsOverviewDto } from '../common/entities/repayments.entities';
import { REPAYMENT_NOT_FOUND, RepaymentsService } from './repayments.service';

// Any signed-in user, as in v1 (admins have no repayments and get empty results).
@ApiTags('User Repayments')
@Access()
@ApiUserUnauthorizedResponse()
@Controller('user/repayments')
export class RepaymentsController {
  constructor(private readonly repaymentsService: RepaymentsService) {}

  @Get()
  @ApiOperation({
    summary: 'The customer’s repayments, newest first',
    description: 'Payroll deductions and liquidations applied to their loans.',
  })
  @ApiOkPaginatedResponse(UserRepaymentDto)
  async repayments(@CurrentUser() user: AuthUser, @Query() query: PaginatedQueryDto) {
    const { data, meta } = await this.repaymentsService.getRepayments(user.userId, query);
    return { data, meta, message: 'Repayments fetched successfully' };
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Repayment overview',
    description:
      'Total repaid, what is still outstanding, this month’s deduction and its payroll month, the last ' +
      'repayment, and the amount repaid per payroll month for the last 12 months.',
  })
  @ApiOkBaseResponse(UserRepaymentsOverviewDto)
  async overview(@CurrentUser() user: AuthUser) {
    const data = await this.repaymentsService.getOverview(user.userId);
    return { data, message: 'Repayment overview retrieved successfully' };
  }

  @Get('history')
  @ApiOperation({
    summary: 'Repayment history by payroll month',
    description: '`from` / `to` (YYYY-MM, inclusive, both optional) filter by the payroll month of the payment.',
  })
  @ApiOkPaginatedResponse(UserRepaymentDto)
  @ApiDtoErrorResponse('from must be a month as YYYY-MM')
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    msg: '`from` must not be after `to`',
    desc: 'The range is backwards',
  })
  async history(@CurrentUser() user: AuthUser, @Query() query: UserRepaymentsQueryDto) {
    const { data, meta } = await this.repaymentsService.getRepayments(user.userId, query);
    return { data, meta, message: 'Repayment history fetched successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'One repayment' })
  @ApiOkBaseResponse(UserRepaymentDto)
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    msg: REPAYMENT_NOT_FOUND,
    desc: 'No repayment on the customer’s loans has this id',
  })
  async getRepayment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const data = await this.repaymentsService.getRepayment(user.userId, id);
    return { data, message: 'Repayment retrieved successfully' };
  }
}
