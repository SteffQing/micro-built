import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Access, Confirm, CurrentUser } from 'src/auth/decorators';
import {
  ApiDtoErrorResponse,
  ApiGenericErrorResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import { PeriodRangeQueryDto } from 'src/common/dto';
import type { AuthUser } from 'src/common/types';
import { ALREADY_DECIDED } from 'src/ledger/ledger.constants';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import {
  FilterAppliedRepaymentsDto,
  FilterDeductionsDto,
  FilterRepaymentsDto,
  ManualRepaymentResolutionDto,
  PeriodDto,
  RejectLiquidationDto,
} from '../common/dto/repayment.dto';
import {
  AppliedRepaymentListItemDto,
  DeductionDetailDto,
  DeductionListItemDto,
  LiquidationDecisionResultDto,
  ManualResolutionResultDto,
  PeriodCloseSummaryDto,
  RepaymentDetailDto,
  RepaymentListItemDto,
  RepaymentOverviewDto,
  SignedFileUrlDto,
} from '../common/entities/repayment.entity';
import { RepaymentsService } from './repayments.service';

// Upload and validate are PayrollUploadController's (registered first, so its literal paths win
// over `:id` here).
@ApiTags('Admin Repayments')
@Access('ADMIN', 'SUPER_ADMIN')
@Controller('admin/repayments')
export class RepaymentsController {
  constructor(private readonly service: RepaymentsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Repayment overview',
    description:
      'Deductions sent to payroll for the payroll months `from..to` (YYYY-MM, default: the current Lagos month): ' +
      'expected, collected, overdue, underpaid and failed, plus what is still awaited for the current month.',
  })
  @ApiOkBaseResponse(RepaymentOverviewDto)
  @ApiDtoErrorResponse('from must be a month as YYYY-MM')
  @ApiRoleForbiddenResponse()
  async getOverview(@Query() query: PeriodRangeQueryDto) {
    return { data: await this.service.overview(query), message: 'Repayment overview fetched successfully' };
  }

  @Get('inflows')
  @ApiOperation({
    summary: 'List money received',
    description:
      'Payroll rows and liquidations (PaymentInflow), newest first, with how much of each was applied to a loan.',
  })
  @ApiOkPaginatedResponse(RepaymentListItemDto)
  @ApiDtoErrorResponse('state must be one of the following values: UNMATCHED, AWAITING, REVIEWING, SETTLED, REJECTED')
  @ApiRoleForbiddenResponse()
  async getRepayments(@Query() dto: FilterRepaymentsDto) {
    const { rows, total } = await this.service.list(dto);
    return {
      data: rows,
      message: 'Repayments fetched successfully',
      meta: { total, page: dto.page ?? 1, limit: dto.limit ?? 20 },
    };
  }

  @Get('deductions')
  @ApiOperation({
    summary: 'List deductions',
    description:
      'What each loan is expected to pay per payroll month (newest month first) and how much of it has been paid.',
  })
  @ApiOkPaginatedResponse(DeductionListItemDto)
  @ApiDtoErrorResponse('status must be one of the following values: OPEN, AWAITING, FULFILLED, PARTIAL, FAILED')
  @ApiRoleForbiddenResponse()
  async getDeductions(@Query() dto: FilterDeductionsDto) {
    const { rows, total } = await this.service.listDeductions(dto);
    return {
      data: rows,
      message: 'Deductions fetched successfully',
      meta: { total, page: dto.page ?? 1, limit: dto.limit ?? 20 },
    };
  }

  @Get('deductions/:deductionId')
  @ApiOperation({
    summary: 'One deduction',
    description:
      'The deduction with the payments applied to it (split into principal, interest and penalty). While it is ' +
      'OPEN, `calculation` shows how its amount is worked out: (outstanding − committed) ÷ remaining months.',
  })
  @ApiOkBaseResponse(DeductionDetailDto)
  @ApiGenericErrorResponse({ code: 404, err: 'Not Found', msg: 'Deduction not found', desc: 'Unknown id' })
  @ApiRoleForbiddenResponse()
  async getDeduction(@Param('deductionId') deductionId: string) {
    const data = await this.service.deductionDetail(deductionId);
    return { data, message: 'Deduction fetched successfully' };
  }

  @Get('applied')
  @ApiOperation({
    summary: 'List repayments applied to loans',
    description: 'Payments applied to a loan, newest first, split into principal, interest and penalty.',
  })
  @ApiOkPaginatedResponse(AppliedRepaymentListItemDto)
  @ApiDtoErrorResponse('from must be a month as YYYY-MM')
  @ApiRoleForbiddenResponse()
  async getApplied(@Query() dto: FilterAppliedRepaymentsDto) {
    const { rows, total } = await this.service.listApplied(dto);
    return {
      data: rows,
      message: 'Applied repayments fetched successfully',
      meta: { total, page: dto.page ?? 1, limit: dto.limit ?? 20 },
    };
  }

  @Post('close-period')
  @Confirm('action')
  @HttpCode(HttpStatus.OK)
  @Access('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Close a payroll month',
    description:
      'Whatever payroll did not pay for the month becomes final: missed deductions FAILED, short ones PARTIAL, each ' +
      'shortfall charged a penalty. If some deductions fail to close, `closed` is false: run it again (done rows are skipped).',
  })
  @ApiOkBaseResponse(PeriodCloseSummaryDto)
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    desc: "The month's variation isn't submitted, it is already closed, or no penalty rate is set",
    msg: 'Submit the JUNE 2026 variation before closing it',
  })
  @ApiRoleForbiddenResponse()
  async closePeriod(@Body() dto: PeriodDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.closePeriod(dto.period, user.userId);
    return {
      data,
      message: data.closed
        ? `${data.label} is closed`
        : `${data.label} is not closed yet: ${data.errors.length} deductions could not be closed. Run the close again.`,
    };
  }

  @Get('inflows/:id')
  @ApiOperation({
    summary: 'One payment received',
    description:
      'The payment, what was applied (split into principal, interest and penalty), the deduction it settled, ' +
      "the customer's loan figures and the admin decisions on it.",
  })
  @ApiOkBaseResponse(RepaymentDetailDto)
  @ApiGenericErrorResponse({ code: 404, err: 'Not Found', desc: 'No such payment', msg: 'Payment not found' })
  @ApiRoleForbiddenResponse()
  async getRepayment(@Param('id') id: string) {
    return { data: await this.service.detail(id), message: 'Repayment retrieved successfully' };
  }

  @Get('inflows/:id/proof')
  @ApiOperation({
    summary: "Open a liquidation's proof of payment",
    description: 'A signed link to the proof, valid for 5 minutes.',
  })
  @ApiOkBaseResponse(SignedFileUrlDto)
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    desc: 'No such payment, or it has no proof',
    msg: 'This payment has no proof attached',
  })
  @ApiRoleForbiddenResponse()
  async getProof(@Param('id') id: string) {
    return { data: await this.service.proofUrl(id), message: 'Proof link created' };
  }

  @Patch('inflows/:id/manual-resolution')
  @ApiOperation({
    summary: 'Resolve a payroll payment by hand',
    description:
      'For UNMATCHED or REVIEWING payroll payments. APPLY (`customerId`): pay it into that customer\'s active loan, ' +
      "settling the month's deduction when one is due; it stays REVIEWING if more was paid than owed. SETTLE (`note`): " +
      'close such an overpayment once the excess is refunded. REJECT (`note`): drop a payment that belongs to no loan.',
  })
  @ApiOkBaseResponse(ManualResolutionResultDto)
  @ApiDtoErrorResponse('Add a note explaining this decision')
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    desc: 'Already resolved (by another admin), the customer has no active loan, or the action does not fit the payment',
    msg: ALREADY_DECIDED,
  })
  @ApiRoleForbiddenResponse()
  async resolveRepayment(
    @Param('id') id: string,
    @Body() dto: ManualRepaymentResolutionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.resolve(id, dto, user.userId);
    const message =
      dto.action === 'REJECT'
        ? 'The payment has been rejected'
        : data.state === 'REVIEWING'
          ? 'The payment was applied; the amount paid beyond what was owed still needs a refund'
          : 'The payment has been resolved';
    return { data, message };
  }

  @Patch('inflows/:id/accept-liquidation')
  @Confirm('action')
  @Access('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Accept a liquidation',
    description: "Applies the payment to the customer's active loan at once (it must not exceed what is outstanding).",
  })
  @ApiOkBaseResponse(LiquidationDecisionResultDto)
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    desc: 'Already decided, no active loan, or more than is now outstanding',
    msg: ALREADY_DECIDED,
  })
  @ApiRoleForbiddenResponse()
  async acceptLiquidation(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return {
      data: await this.service.decideLiquidation(id, true, user.userId),
      message: 'The liquidation has been accepted and applied to the loan',
    };
  }

  @Patch('inflows/:id/reject-liquidation')
  @Access('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Reject a liquidation',
    description: 'The `note` (required) says why; it is kept in the audit log and shown to the customer.',
  })
  @ApiDtoErrorResponse('Say why the liquidation is rejected')
  @ApiOkBaseResponse(LiquidationDecisionResultDto)
  @ApiGenericErrorResponse({ code: 409, err: 'Conflict', desc: 'Already decided', msg: ALREADY_DECIDED })
  @ApiRoleForbiddenResponse()
  async rejectLiquidation(@Param('id') id: string, @Body() dto: RejectLiquidationDto, @CurrentUser() user: AuthUser) {
    return {
      data: await this.service.decideLiquidation(id, false, user.userId, dto.note),
      message: 'The liquidation has been rejected',
    };
  }
}
