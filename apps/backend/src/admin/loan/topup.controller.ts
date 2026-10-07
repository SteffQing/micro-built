import { AdminNotifierService } from 'src/notifications/admin-notifier.service';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Access, Confirm, CurrentUser, Roles } from 'src/auth/decorators';
import { ApiGenericErrorResponse, ApiOkBaseResponse, ApiOkPaginatedResponse } from 'src/common/decorators';
import type { AuthUser } from 'src/common/types';
import { ALREADY_DECIDED, LOAN_NOT_ACTIVE } from 'src/ledger/ledger.constants';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { ApproveTopupDto, LoanRejectionDto, TopupQueryDto } from '../common/dto/loan.dto';
import { TopupItemDto } from '../common/entities/loan.entities';
import { TopupService } from './topup.service';

const NOT_FOUND = { code: 404, err: 'Not Found', msg: 'Top-up not found', desc: 'No top-up with this id' };

@ApiTags('Admin:Top-ups')
@Access('ADMIN', 'SUPER_ADMIN')
@Controller('admin/loans/topups')
export class TopupController {
  constructor(
    private readonly topups: TopupService,
    private readonly notifier: AdminNotifierService,
  ) {}

  /** A marketer's escalations about it are done (best effort). */
  private settled(kind: 'LOAN' | 'ASSET_REQUEST' | 'TOPUP', id: string) {
    const done = kind === 'ASSET_REQUEST' ? this.notifier.clearEscalations(kind, id) : this.notifier.clearPayoutEscalations(kind, id);
    void done.catch(() => undefined);
  }


  @Get()
  @ApiOperation({
    summary: 'List top-ups',
    description: 'Top-up requests on running loans, newest first, with the tenure change requested with each',
  })
  @ApiOkPaginatedResponse(TopupItemDto)
  @ApiRoleForbiddenResponse()
  list(@Query() query: TopupQueryDto) {
    return this.topups.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a top-up',
    description: 'One top-up with its customer, the tenure change requested with it and the asset it pays for',
  })
  @ApiOkBaseResponse(TopupItemDto)
  @ApiGenericErrorResponse(NOT_FOUND)
  @ApiRoleForbiddenResponse()
  async get(@Param('id') id: string) {
    return { data: await this.topups.get(id), message: 'Top-up retrieved' };
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a top-up',
    description:
      'PENDING → APPROVED, with the tenure change requested alongside it (applied on disbursement). The body may ' +
      'replace or drop that change (monthsDelta) and say whether it reprices the running loan (reprice).',
  })
  @ApiOkBaseResponse(TopupItemDto)
  @ApiGenericErrorResponse(NOT_FOUND)
  @ApiGenericErrorResponse({ code: 409, err: 'Conflict', msg: ALREADY_DECIDED, desc: 'No longer pending' })
  @ApiRoleForbiddenResponse()
  async approve(@Param('id') id: string, @Body() dto: ApproveTopupDto, @CurrentUser() user: AuthUser) {
    await this.topups.approve(id, user.userId, dto);
    this.settled('TOPUP', id);
    return { data: await this.topups.get(id), message: 'Top-up approved' };
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a top-up',
    description:
      'A pending or approved (not yet disbursed) top-up is turned down with its tenure change, and the asset request it pays for (if any). The note is kept in the audit log.',
  })
  @ApiOkBaseResponse(TopupItemDto)
  @ApiGenericErrorResponse(NOT_FOUND)
  @ApiGenericErrorResponse({ code: 409, err: 'Conflict', msg: ALREADY_DECIDED, desc: 'Already decided' })
  @ApiRoleForbiddenResponse()
  async reject(@Param('id') id: string, @Body() dto: LoanRejectionDto, @CurrentUser() user: AuthUser) {
    await this.topups.reject(id, user.userId, dto.note);
    this.settled('TOPUP', id);
    return { data: await this.topups.get(id), message: 'Top-up rejected' };
  }

  @Patch(':id/disburse')
  @Confirm('window')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disburse a top-up',
    description:
      'APPROVED → DISBURSED: applies its tenure change, books interest for the months left and re-spreads the monthly ' +
      'deduction. The body may still change the approved tenure change first (`monthsDelta` ≥ 0, 0 drops it; `reprice`); ' +
      'an empty body applies it as approved. SUPER_ADMIN only.',
  })
  @ApiOkBaseResponse(TopupItemDto)
  @ApiGenericErrorResponse(NOT_FOUND)
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    msg: 'Only an approved top-up can be disbursed',
    desc: `Not approved, or the loan is no longer running ("${LOAN_NOT_ACTIVE}")`,
  })
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    msg: "This customer's account is restricted. Review their status before disbursing.",
    desc: 'The customer is flagged or deactivated',
  })
  @ApiRoleForbiddenResponse()
  async disburse(@Param('id') id: string, @Body() dto: ApproveTopupDto, @CurrentUser() user: AuthUser) {
    await this.topups.disburse(id, user.userId, dto ?? {});
    this.settled('TOPUP', id);
    return { data: await this.topups.get(id), message: 'Top-up disbursed' };
  }
}
