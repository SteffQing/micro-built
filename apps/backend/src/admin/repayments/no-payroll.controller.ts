import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Access, Confirm, CurrentUser } from 'src/auth/decorators';
import { ApiDtoErrorResponse, ApiGenericErrorResponse, ApiOkBaseResponse } from 'src/common/decorators';
import type { AuthUser } from 'src/common/types';
import { VariationLockService } from 'src/ledger/variation-lock.service';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { NoPayrollResultDto, NoPayrollRevertResultDto, ReasonDto } from './vouchers.dto';

// No payroll (PLAN_V2 R5): the voucher for a variation's month never came. It lives beside the vouchers because it
// locks and settles a variation the way a voucher does; the variation routes themselves are admin/variations'.
@ApiTags('Variations')
@Access('SUPER_ADMIN')
@Controller('admin/variations')
export class NoPayrollController {
  constructor(private readonly locks: VariationLockService) {}

  @Post(':id/no-payroll')
  @Confirm('action')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a variation No payroll',
    description:
      'The organization never sent the voucher for a month that has ended. The variation locks and everyone in it is ' +
      'treated as having paid nothing: their deductions FAIL and each is charged a penalty, as when a voucher comes in ' +
      'short. Only once the month has ended (Lagos), and only when the organization has no earlier month still waiting ' +
      'for its voucher (do the earliest first). Needs a reason; the audit log records NO_PAYROLL.',
  })
  @ApiOkBaseResponse(NoPayrollResultDto)
  @ApiDtoErrorResponse('Say why, in a few words')
  @ApiGenericErrorResponse({ code: 404, err: 'Not Found', desc: 'No such variation', msg: 'Variation not found' })
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    desc: "Already locked, the month hasn't ended, or an earlier month of the organization is unlocked",
    msg: "MAY 2026 hasn't ended yet",
  })
  @ApiRoleForbiddenResponse()
  async noPayroll(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthUser) {
    const data = await this.locks.noPayroll(id, dto.reason, user.userId);
    return {
      data,
      message: `${data.label} is marked No payroll: ${data.failed} deductions failed and ${data.penalties} penalties were charged`,
    };
  }

  @Delete(':id/no-payroll')
  @Confirm('action')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Undo No payroll',
    description:
      'The voucher turned up after all: the penalties and pending tenure proposals the No payroll charged are removed and the ' +
      'variation waits for its voucher again (upload it next). Allowed while no later month of the organization is locked; ' +
      "a later month that was already generated gets a regenerate hint. Refused after a payment applied to the loans since (an " +
      'accepted liquidation) or a decided tenure proposal. Needs a reason; the audit log records NO_PAYROLL_REVERTED.',
  })
  @ApiOkBaseResponse(NoPayrollRevertResultDto)
  @ApiDtoErrorResponse('Say why, in a few words')
  @ApiGenericErrorResponse({ code: 404, err: 'Not Found', desc: 'No such variation', msg: 'Variation not found' })
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    desc: "Not marked No payroll, a later month is locked, or money has moved since",
    msg: "NPF's JUNE 2026 variation is locked: undo it first, since it was settled after MAY 2026",
  })
  @ApiRoleForbiddenResponse()
  async revertNoPayroll(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthUser) {
    const { variationId, penaltiesRemoved, proposalsWithdrawn, label } = await this.locks.revertNoPayroll(
      id,
      dto.reason,
      user.userId,
    );
    return {
      data: { variationId, penaltiesRemoved, proposalsWithdrawn },
      message: `${label} is no longer marked No payroll: its voucher can be uploaded`,
    };
  }
}
