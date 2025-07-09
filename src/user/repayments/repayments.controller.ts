import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiUserUnauthorizedResponse } from '../common/decorators';
import { Request } from 'express';
import { AuthUser } from 'src/common/types';
import {
  ApiGenericErrorResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
  ApiOkResponseWith,
} from 'src/common/decorators';
import {
  RepaymentHistoryItem,
  RepaymentOverviewResponseDto,
  RepaymentQueryDto,
  RepaymentsSummaryDto,
} from '../common/dto';
import { RepaymentStatus } from '@prisma/client';

@ApiTags('User Repayments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/repayments')
export class RepaymentsController {
  constructor(private readonly repaymentsService: RepaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get yearly repayment summary for charting' })
  @ApiQuery({
    name: 'year',
    required: false,
    example: 2025,
    description: 'Repayments summary for the given year',
  })
  @ApiOkResponse({
    type: RepaymentsSummaryDto,
    description: 'Monthly repayment summary for user',
  })
  @ApiUserUnauthorizedResponse()
  repayments(@Req() req: Request, @Query('year') year?: number) {
    const { userId } = req.user as AuthUser;
    const _year = year ? +year : undefined;
    return this.repaymentsService.getYearlyRepaymentSummary(userId, _year);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get repayment overview (total paid, net, etc.)' })
  @ApiUserUnauthorizedResponse()
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    msg: 'User external ID not found',
    desc: 'User external ID is not linked!',
  })
  @ApiOkBaseResponse(RepaymentOverviewResponseDto)
  overview(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    return this.repaymentsService.getRepaymentOverview(userId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get repayment history for user' })
  @ApiQuery({ name: 'status', enum: RepaymentStatus, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiOkPaginatedResponse(RepaymentHistoryItem)
  @ApiUserUnauthorizedResponse()
  history(@Req() req: Request, @Query() query: RepaymentQueryDto) {
    const { userId } = req.user as AuthUser;
    return this.repaymentsService.getRepaymentHistory(
      userId,
      query.limit,
      query.page,
      query.status,
    );
  }
}
