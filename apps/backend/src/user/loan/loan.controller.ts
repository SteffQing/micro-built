import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiExtraModels, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { Access, CurrentUser } from 'src/auth/decorators';
import {
  ApiDtoErrorResponse,
  ApiGenericErrorResponse,
  ApiNullOkResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import { BaseResponseDto, PaginatedQueryDto } from 'src/common/dto/generic.dto';
import type { AuthUser } from 'src/common/types';
import { LOAN_NOT_ACTIVE } from 'src/ledger/ledger.constants';
import { ApiUserUnauthorizedResponse } from '../common/decorators/auth-user';
import {
  CreateLoanDto,
  LoanHistoryRequestDto,
  UpdateLoanDto,
  UserCommodityLoanRequestDto,
} from '../common/dto/loan.dto';
import {
  UserCommodityRequestDto,
  UserLoanDetailDto,
  UserLoanItemDto,
  UserLoanRequestItemDto,
  UserLoanRequestResultDto,
  UserLoansOverviewDto,
} from '../common/entities/loan.entities';
import {
  ACCOUNT_RESTRICTED,
  ASSET_LOAN_NOT_EDITABLE,
  ASSET_REQUEST_IN_REVIEW,
  CATEGORY_REQUIRED,
  COMMODITY_REQUEST_NOT_FOUND,
  COMMODITY_UNAVAILABLE,
  LOAN_IN_PROGRESS,
  LOAN_NOT_FOUND,
  LoanService,
  NOT_A_CUSTOMER,
  NOTHING_TO_UPDATE,
  ONLY_PENDING,
  TOPUP_WAITING,
} from './loan.service';

const ApiRequestCreated = (description: string) =>
  ApiCreatedResponse({
    description,
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        { properties: { data: { $ref: getSchemaPath(UserLoanRequestResultDto) } } },
      ],
    },
  });

const ApiNotACustomer = () =>
  ApiGenericErrorResponse({ code: 403, err: 'Forbidden', msg: NOT_A_CUSTOMER, desc: 'The account has no customer profile' });

const ApiRestricted = () =>
  ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    msg: ACCOUNT_RESTRICTED,
    desc: 'The account is under review (FLAGGED)',
  });

// Any signed-in user, as in v1; requests need a customer profile (admins get 403).
@ApiTags('User Loan')
@Access()
@ApiUserUnauthorizedResponse()
@ApiExtraModels(BaseResponseDto, UserLoanRequestResultDto)
@Controller('user/loan')
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Requests waiting for a decision, and loan counts by status',
    description:
      'Loans PENDING or APPROVED (not yet disbursed), top-ups PENDING or APPROVED, asset requests IN_REVIEW, ' +
      'and how many of the customer’s loans are REJECTED, APPROVED, DISBURSED and REPAID.',
  })
  @ApiOkBaseResponse(UserLoansOverviewDto)
  async getOverview(@CurrentUser() user: AuthUser) {
    const data = await this.loanService.getOverview(user.userId);
    return { data, message: 'Pending loans and loans data retrieved successfully!' };
  }

  @Get('all')
  @ApiOperation({
    summary: 'Every loan request, newest first',
    description:
      'Loans, cash top-ups and asset requests in one list (`kind` LOAN, TOPUP or COMMODITY). An asset top-up ' +
      'appears once, as its asset request.',
  })
  @ApiOkPaginatedResponse(UserLoanRequestItemDto)
  async getAllLoans(@CurrentUser() user: AuthUser, @Query() query: PaginatedQueryDto) {
    const { data, meta } = await this.loanService.getAllRequests(user.userId, query);
    return { data, meta, message: 'Loan history retrieved successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'The customer’s loans with their ledger figures, newest first' })
  @ApiOkPaginatedResponse(UserLoanItemDto)
  @ApiDtoErrorResponse('status must be one of the following values: PENDING, REJECTED, APPROVED, DISBURSED, REPAID')
  async getLoans(@CurrentUser() user: AuthUser, @Query() query: LoanHistoryRequestDto) {
    const { data, meta } = await this.loanService.getLoans(user.userId, query);
    return { data, meta, message: 'Loan history retrieved successfully' };
  }

  @Post()
  @ApiOperation({
    summary: 'Request a loan, or a top-up on the running loan',
    description:
      'With a disbursed loan this asks for a top-up of `amount` on it (`kind: TOPUP`, `category` ignored). ' +
      'Otherwise a new PENDING loan (`kind: LOAN`; `category` required); an admin sets its tenure and rates ' +
      'when approving it.',
  })
  @ApiRequestCreated('Loan or top-up requested')
  @ApiDtoErrorResponse('amount must be more than zero')
  @ApiGenericErrorResponse({ code: 400, err: 'Bad Request', msg: CATEGORY_REQUIRED, desc: 'A new loan needs a category' })
  @ApiRestricted()
  @ApiNotACustomer()
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    msg: LOAN_IN_PROGRESS,
    desc: `A loan is PENDING or APPROVED, or the running loan already has a top-up waiting ("${TOPUP_WAITING}")`,
  })
  async applyLoan(@CurrentUser() user: AuthUser, @Body() dto: CreateLoanDto) {
    const data = await this.loanService.requestCashLoan(user.userId, dto);
    return {
      data,
      message:
        data.kind === 'TOPUP'
          ? 'Your top-up request has been submitted for review'
          : 'Loan application submitted successfully',
    };
  }

  @Post('commodity')
  @ApiOperation({
    summary: 'Request an asset (commodity loan)',
    description:
      'Must name an active commodity (any letter case). With a disbursed loan this adds an asset request to ' +
      'it (`kind: TOPUP`; an admin prices and approves it as a top-up). Otherwise a new asset loan ' +
      '(`kind: LOAN`; ASSET_PURCHASE, PENDING, priced on approval). `id` is the asset request’s id.',
  })
  @ApiRequestCreated('Asset requested')
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    msg: COMMODITY_UNAVAILABLE,
    desc: 'No active commodity has that name',
  })
  @ApiRestricted()
  @ApiNotACustomer()
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    msg: LOAN_IN_PROGRESS,
    desc:
      `A loan is PENDING or APPROVED; or, on the running loan, an asset request is in review ("${ASSET_REQUEST_IN_REVIEW}"), ` +
      `a top-up is waiting ("${TOPUP_WAITING}") or the loan just closed ("${LOAN_NOT_ACTIVE}")`,
  })
  async requestCommodityLoan(@CurrentUser() user: AuthUser, @Body() dto: UserCommodityLoanRequestDto) {
    const data = await this.loanService.requestCommodityLoan(user.userId, dto.assetName);
    return {
      data,
      message: `You have successfully requested a commodity loan for ${dto.assetName.trim()}! Please keep an eye out for communication lines from our support`,
    };
  }

  @Get('commodity')
  @ApiOperation({ summary: 'The customer’s asset requests, newest first' })
  @ApiOkPaginatedResponse(UserCommodityRequestDto)
  async getCommodityLoanHistory(@CurrentUser() user: AuthUser, @Query() query: PaginatedQueryDto) {
    const { data, meta } = await this.loanService.getCommodityRequests(user.userId, query);
    return { data, meta, message: 'Commodity Loan history retrieved successfully' };
  }

  @Get('commodity/:cLoanId')
  @ApiOperation({ summary: 'One asset request' })
  @ApiOkBaseResponse(UserCommodityRequestDto)
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    msg: COMMODITY_REQUEST_NOT_FOUND,
    desc: 'No asset request of the customer’s has this id',
  })
  async getCommodityLoanById(@CurrentUser() user: AuthUser, @Param('cLoanId') cLoanId: string) {
    const data = await this.loanService.getCommodityRequest(user.userId, cLoanId);
    return { data, message: 'Commodity loan has been queried successfully' };
  }

  @Get(':loanId')
  @ApiOperation({ summary: 'One loan with its figures, top-ups and asset requests' })
  @ApiOkBaseResponse(UserLoanDetailDto)
  @ApiGenericErrorResponse({ code: 404, err: 'Not Found', msg: LOAN_NOT_FOUND, desc: 'No loan of the customer’s has this id' })
  async getLoanById(@CurrentUser() user: AuthUser, @Param('loanId') loanId: string) {
    const data = await this.loanService.getLoan(user.userId, loanId);
    return { data, message: 'Loan details retrieved successfully' };
  }

  @Put(':loanId')
  @ApiOperation({ summary: 'Change the amount or category of a loan request still PENDING' })
  @ApiNullOkResponse('Loan request updated', 'Loan application updated successfully')
  @ApiGenericErrorResponse({ code: 400, err: 'Bad Request', msg: NOTHING_TO_UPDATE, desc: 'Neither field was sent' })
  @ApiGenericErrorResponse({ code: 404, err: 'Not Found', msg: LOAN_NOT_FOUND, desc: 'No loan of the customer’s has this id' })
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    msg: ONLY_PENDING,
    desc: `The loan is no longer PENDING, or it is an asset request ("${ASSET_LOAN_NOT_EDITABLE}")`,
  })
  async updateLoan(@CurrentUser() user: AuthUser, @Param('loanId') loanId: string, @Body() dto: UpdateLoanDto) {
    await this.loanService.updateLoan(user.userId, loanId, dto);
    return { data: null, message: 'Loan application updated successfully' };
  }

  @Delete(':loanId')
  @ApiOperation({
    summary: 'Withdraw a loan request still PENDING',
    description: 'Also removes the asset request of a pending asset loan.',
  })
  @ApiNullOkResponse('Loan request deleted', 'Loan deleted successfully')
  @ApiGenericErrorResponse({ code: 404, err: 'Not Found', msg: LOAN_NOT_FOUND, desc: 'No loan of the customer’s has this id' })
  @ApiGenericErrorResponse({ code: 409, err: 'Conflict', msg: ONLY_PENDING, desc: 'The loan is no longer PENDING' })
  async deleteLoan(@CurrentUser() user: AuthUser, @Param('loanId') loanId: string) {
    await this.loanService.deleteLoan(user.userId, loanId);
    return { data: null, message: 'Loan deleted successfully' };
  }
}
