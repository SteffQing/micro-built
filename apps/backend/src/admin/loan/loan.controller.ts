import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Access, Confirm, CurrentUser, Roles } from 'src/auth/decorators';
import {
  ApiDtoErrorResponse,
  ApiGenericErrorResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import type { AuthUser } from 'src/common/types';
import { ALREADY_DECIDED } from 'src/ledger/ledger.constants';
import { AdminNotifierService } from 'src/notifications/admin-notifier.service';
import { RATES_NOT_SET } from 'src/settings/settings.service';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import {
  AcceptCommodityLoanDto,
  CashLoanQueryDto,
  CommodityLoanQueryDto,
  LoanRejectionDto,
  LoanTermsDto,
} from '../common/dto/loan.dto';
import {
  CashLoanDto,
  CashLoanItemDto,
  CommodityLoanDto,
  CommodityLoanItemDto,
} from '../common/entities/loan.entities';
import { ASSET_REQUEST_NOT_FOUND, CashLoanService, CommodityLoanService, LOAN_NOT_FOUND } from './loan.service';

const loanNotFound = { code: 404, err: 'Not Found', msg: LOAN_NOT_FOUND, desc: 'No loan with this id' };
const requestNotFound = {
  code: 404,
  err: 'Not Found',
  msg: ASSET_REQUEST_NOT_FOUND,
  desc: 'No asset request with this id',
};

@ApiTags('Admin:Cash Loans')
@Access('ADMIN', 'SUPER_ADMIN')
@Controller('admin/loans/cash')
export class CashLoanController {
  constructor(
    private readonly loanService: CashLoanService,
    private readonly notifier: AdminNotifierService,
  ) {}

  /** A marketer's escalations about it are done (best effort). */
  private settled(kind: 'LOAN' | 'ASSET_REQUEST' | 'TOPUP', id: string) {
    const done = kind === 'ASSET_REQUEST' ? this.notifier.clearEscalations(kind, id) : this.notifier.clearPayoutEscalations(kind, id);
    void done.catch(() => undefined);
  }


  @Get()
  @ApiOperation({
    summary: 'List cash loans',
    description: 'Every loan except asset loans (listed under commodity requests), newest first, with its figures',
  })
  @ApiOkPaginatedResponse(CashLoanItemDto)
  @ApiRoleForbiddenResponse()
  getAll(@Query() query: CashLoanQueryDto) {
    return this.loanService.getAllLoans(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a loan',
    description: 'Any loan by id, cash or asset, with its figures, asset requests and top-ups',
  })
  @ApiOkBaseResponse(CashLoanDto)
  @ApiGenericErrorResponse(loanNotFound)
  @ApiRoleForbiddenResponse()
  async getLoan(@Param('id') loanId: string) {
    return { data: await this.loanService.getLoan(loanId), message: 'Loan details retrieved successfully' };
  }

  @Patch(':id/disburse')
  @Confirm('window')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disburse a loan',
    description:
      'APPROVED → DISBURSED through the ledger: books principal and interest, opens the first monthly deduction and, for an asset loan, links its asset request. Cash and asset loans alike. SUPER_ADMIN only.',
  })
  @ApiOkBaseResponse(CashLoanDto)
  @ApiGenericErrorResponse(loanNotFound)
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    msg: 'Only an approved loan can be disbursed',
    desc: `Not approved, or "${RATES_NOT_SET}" until a super admin sets the rates`,
  })
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    msg: "This customer's account is restricted. Review their status before disbursing.",
    desc: 'The customer is flagged or deactivated',
  })
  @ApiRoleForbiddenResponse()
  async disburseLoan(@Param('id') loanId: string, @CurrentUser() user: AuthUser) {
    await this.loanService.disburseLoan(loanId, user.userId);
    this.settled('LOAN', loanId);
    return { data: await this.loanService.getLoan(loanId), message: 'Loan disbursed successfully' };
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a loan',
    description:
      "PENDING → APPROVED with the tenure; Settings' interest and management fee rates are snapshotted onto the loan. Asset loans are approved from their asset request.",
  })
  @ApiOkBaseResponse(CashLoanDto)
  @ApiDtoErrorResponse('tenure must not be less than 1')
  @ApiGenericErrorResponse(loanNotFound)
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    msg: ALREADY_DECIDED,
    desc: `No longer pending, an asset loan, or "${RATES_NOT_SET}"`,
  })
  @ApiRoleForbiddenResponse()
  async approveLoan(@Param('id') loanId: string, @Body() dto: LoanTermsDto, @CurrentUser() user: AuthUser) {
    await this.loanService.approveLoan(loanId, dto, user.userId);
    this.settled('LOAN', loanId);
    return { data: await this.loanService.getLoan(loanId), message: 'Loan approved successfully' };
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a loan',
    description:
      'A pending or approved (not yet disbursed) loan is turned down, with any asset request on it. The note is kept in the audit log.',
  })
  @ApiOkBaseResponse(CashLoanDto)
  @ApiGenericErrorResponse(loanNotFound)
  @ApiGenericErrorResponse({ code: 409, err: 'Conflict', msg: ALREADY_DECIDED, desc: 'Already decided or disbursed' })
  @ApiRoleForbiddenResponse()
  async rejectLoan(@Param('id') loanId: string, @Body() dto: LoanRejectionDto, @CurrentUser() user: AuthUser) {
    await this.loanService.rejectLoan(loanId, dto, user.userId);
    this.settled('LOAN', loanId);
    return { data: await this.loanService.getLoan(loanId), message: 'Loan rejected successfully' };
  }
}

@ApiTags('Admin:Commodity Loans')
@Access('ADMIN', 'SUPER_ADMIN')
@Controller('admin/loans/commodity')
export class CommodityLoanController {
  constructor(
    private readonly loanService: CommodityLoanService,
    private readonly notifier: AdminNotifierService,
  ) {}

  /** A marketer's escalations about it are done (best effort). */
  private settled(kind: 'LOAN' | 'ASSET_REQUEST' | 'TOPUP', id: string) {
    const done = kind === 'ASSET_REQUEST' ? this.notifier.clearEscalations(kind, id) : this.notifier.clearPayoutEscalations(kind, id);
    void done.catch(() => undefined);
  }


  @Get()
  @ApiOperation({
    summary: 'List asset requests',
    description: 'New asset loans and asset top-ups, newest first, filtered by decision, search or request date',
  })
  @ApiOkPaginatedResponse(CommodityLoanItemDto)
  @ApiRoleForbiddenResponse()
  getAll(@Query() query: CommodityLoanQueryDto) {
    return this.loanService.getAllLoans(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an asset request',
    description: 'With its private details (admins only), the loan it belongs to and, for a top-up, its top-up',
  })
  @ApiOkBaseResponse(CommodityLoanDto)
  @ApiGenericErrorResponse(requestNotFound)
  @ApiRoleForbiddenResponse()
  async getLoan(@Param('id') requestId: string) {
    return { data: await this.loanService.getLoan(requestId), message: 'Loan details retrieved successfully' };
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve an asset request',
    description:
      "A request that opens an asset loan: sets the loan's amount, tenure (required) and Settings' rates; the loan is then APPROVED and disbursed with PATCH /admin/loans/cash/:loanId/disburse. A request on a running loan (asset top-up): requests and approves a top-up of `amount` (optional monthsDelta; tenure not allowed), disbursed with PATCH /admin/loans/topups/:topupId/disburse.",
  })
  @ApiOkBaseResponse(CommodityLoanDto)
  @ApiDtoErrorResponse('Enter the tenure (months) for this asset loan')
  @ApiGenericErrorResponse(requestNotFound)
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    msg: ALREADY_DECIDED,
    desc: `Already decided, its loan is no longer open, or "${RATES_NOT_SET}"`,
  })
  @ApiRoleForbiddenResponse()
  async approveLoan(
    @Param('id') requestId: string,
    @Body() dto: AcceptCommodityLoanDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.loanService.approveCommodityLoan(requestId, dto, user.userId);
    this.settled('ASSET_REQUEST', requestId);
    return { data: await this.loanService.getLoan(requestId), message: 'Commodity Loan has been approved' };
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject an asset request',
    description:
      'IN_REVIEW → REJECTED; a pending asset loan it would have opened is rejected with it. The note is kept in the audit log.',
  })
  @ApiOkBaseResponse(CommodityLoanDto)
  @ApiGenericErrorResponse(requestNotFound)
  @ApiGenericErrorResponse({ code: 409, err: 'Conflict', msg: ALREADY_DECIDED, desc: 'Already decided' })
  @ApiRoleForbiddenResponse()
  async rejectLoan(@Param('id') requestId: string, @Body() dto: LoanRejectionDto, @CurrentUser() user: AuthUser) {
    await this.loanService.rejectCommodityLoan(requestId, dto, user.userId);
    this.settled('ASSET_REQUEST', requestId);
    return { data: await this.loanService.getLoan(requestId), message: 'Commodity Loan has been rejected.' };
  }
}
