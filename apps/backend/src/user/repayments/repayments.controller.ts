import { Body, Controller, Get, HttpCode, Param, Post, Query, UploadedFile } from '@nestjs/common';
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
import { UserInflowsQueryDto, UserRepaymentsQueryDto } from '../common/dto/repayments.dto';
import {
  UserDeductionDto,
  UserInflowDto,
  UserRepaymentDto,
  UserRepaymentsOverviewDto,
} from '../common/entities/repayments.entities';
import { REPAYMENT_NOT_FOUND, RepaymentsService } from './repayments.service';
import { LiquidationRequestsService, PROOF_LINK_SECONDS } from 'src/liquidations/liquidation-requests.service';
import {
  CreateLiquidationDto,
  LiquidationCreatedDto,
  LiquidationHistoryItemDto,
  LiquidationHistoryQueryDto,
  ProofUpload,
  ProofUrlDto,
} from 'src/liquidations/liquidations.dto';

// Any signed-in user, as in v1 (admins have no repayments and get empty results).
@ApiTags('User Repayments')
@Access()
@ApiUserUnauthorizedResponse()
@Controller('user/repayments')
export class RepaymentsController {
  constructor(
    private readonly repaymentsService: RepaymentsService,
    private readonly liquidations: LiquidationRequestsService,
  ) {}

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

  @Get('deductions')
  @ApiOperation({
    summary: 'The customer’s deductions, latest payroll month first',
    description:
      'What payroll is asked to deduct each month and what came in against it. An OPEN deduction has not been ' +
      'sent to payroll yet, so its amount can still change.',
  })
  @ApiOkPaginatedResponse(UserDeductionDto)
  async deductions(@CurrentUser() user: AuthUser, @Query() query: PaginatedQueryDto) {
    const { data, meta } = await this.repaymentsService.getDeductions(user.userId, query);
    return { data, meta, message: 'Deductions fetched successfully' };
  }

  @Get('inflows')
  @ApiOperation({
    summary: 'Money received for the customer, newest first',
    description: 'Payroll remittances, liquidations and (for imported loans) what was repaid before the move.',
  })
  @ApiOkPaginatedResponse(UserInflowDto)
  async inflows(@CurrentUser() user: AuthUser, @Query() query: UserInflowsQueryDto) {
    const { data, meta } = await this.repaymentsService.getInflows(user.userId, query);
    return { data, meta, message: 'Payments received fetched successfully' };
  }

  @Post('liquidation')
  @Access('CUSTOMER')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Pay off some or all of the loan outside payroll',
    description:
      'Multipart, sent direct to the API: `amount` and `proof` of the transfer. A super admin checks the proof and ' +
      'approves it; the amount is then applied to the loan at once. See GET /user/loan/liquidation-preview first.',
  })
  @ProofUpload()
  @ApiOkBaseResponse(LiquidationCreatedDto)
  async requestLiquidation(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLiquidationDto,
    @UploadedFile() proof: Express.Multer.File | undefined,
  ) {
    const data = await this.liquidations.create(user.userId, dto.amount, proof);
    return { data, message: 'Liquidation request sent. You will be notified once it is reviewed.' };
  }

  @Get('liquidations')
  @ApiOperation({ summary: 'The customer’s liquidation requests, newest first, with each decision' })
  @ApiOkPaginatedResponse(LiquidationHistoryItemDto)
  async liquidationHistory(@CurrentUser() user: AuthUser, @Query() query: LiquidationHistoryQueryDto) {
    const { items, meta } = await this.liquidations.history(user.userId, query.page, query.limit, query.state);
    return { data: items, meta, message: 'Liquidation requests fetched successfully' };
  }

  @Get('liquidations/:id/proof')
  @ApiOperation({ summary: 'A short-lived link to the proof sent with a liquidation request' })
  @ApiOkBaseResponse(ProofUrlDto)
  @ApiGenericErrorResponse({ code: 404, err: 'Not Found', msg: 'Liquidation request not found', desc: 'Not theirs' })
  async liquidationProof(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const url = await this.liquidations.proofUrl(id, user.userId);
    return { data: { url, expiresIn: PROOF_LINK_SECONDS }, message: 'Proof link created' };
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
