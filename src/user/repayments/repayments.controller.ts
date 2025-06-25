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
  ApiOkResponseWith,
  ApiSuccessResponse,
} from 'src/common/decorators';
import {
  RepaymentHistoryResponseDto,
  RepaymentOverviewResponseDto,
} from '../common/dto';

@ApiTags('User Repayments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/repayments')
export class RepaymentsController {
  constructor(private readonly repaymentsService: RepaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get yearly repayment summary for charting' })
  @ApiQuery({ name: 'year', required: false, example: 2025 })
  @ApiSuccessResponse(
    'Monthly repayment summary for ${year} retrieved successfully',
    Array<{ month: string; repaid: number }>,
  )
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
  @ApiOkResponseWith(
    RepaymentOverviewResponseDto,
    'Repayment overview retrieved successfully',
  )
  overview(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    return this.repaymentsService.getRepaymentOverview(userId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get repayment history' })
  @ApiOkResponse({
    type: RepaymentHistoryResponseDto,
    description: "paginated return of user's repayment history",
  })
  @ApiUserUnauthorizedResponse()
  history(
    @Req() req: Request,
    @Query('limit') limit = 10,
    @Query('page') page = 1,
  ) {
    const { userId } = req.user as AuthUser;
    return this.repaymentsService.getRepaymentHistory(userId, +limit, +page);
  }
}
