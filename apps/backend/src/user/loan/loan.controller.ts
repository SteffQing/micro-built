import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AuthUser } from 'src/common/types';
import { LoanService } from './loan.service';
import {
  UserCommodityLoanRequestDto,
  CreateLoanDto,
  UpdateLoanDto,
  LoanHistoryRequestDto,
} from '../common/dto';
import { ApiUserUnauthorizedResponse } from '../common/decorators';
import {
  ApiGenericErrorResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
  ApiSuccessResponse,
} from 'src/common/decorators';
import {
  CommodityLoanDataDto,
  LoanDataDto,
  LoanHistoryItem,
  PendingLoanAndLoanCountResponseDto,
  AllUserLoansDto,
  AllCommodityLoansDto,
} from '../common/entities';
import { LoanStatus } from '@prisma/client';

@ApiTags('User Loan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/loan')
export class LoanController {
  constructor(private readonly loanService: LoanService) { }

  @Get('overview')
  @ApiOperation({
    summary: 'Get pending loans and loan status counts',
    description:
      'Returns list of pending loan requests and count of approved, rejected, and disbursed loans',
  })
  @ApiOkBaseResponse(PendingLoanAndLoanCountResponseDto)
  @ApiUserUnauthorizedResponse()
  getPendingLoans(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    return this.loanService.getPendingLoansAndLoanCount(userId);
  }

  @Get('all')
  @ApiOperation({
    summary: 'Get all loans history',
    description:
      'Returns paginated loan request history sorted by creation date',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiOkPaginatedResponse(AllUserLoansDto)
  @ApiUserUnauthorizedResponse()
  getAllLoans(
    @Req() req: Request,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const { userId } = req.user as AuthUser;
    return this.loanService.getAllUserLoans(userId, +limit, +page);
  }

  @Get()
  @ApiOperation({
    summary: 'Get loan history',
    description:
      'Returns paginated loan request history sorted by creation date',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'status', required: false, example: LoanStatus.APPROVED })
  @ApiOkPaginatedResponse(LoanHistoryItem)
  @ApiUserUnauthorizedResponse()
  getLoanHistory(@Req() req: Request, @Query() query: LoanHistoryRequestDto) {
    const { userId } = req.user as AuthUser;
    return this.loanService.getLoanRequestHistory(userId, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Apply for a loan',
    description: 'Submit a new loan application',
  })
  @ApiBody({ type: CreateLoanDto, description: 'Loan data to be submitted' })
  @ApiCreatedResponse({
    description: 'Loan application submitted',
    schema: {
      example: {
        message: 'Loan application submitted successfully',
        data: {
          id: 'LN_Q30E22',
        },
      },
    },
  })
  @ApiGenericErrorResponse({
    code: 401,
    err: 'Unauthorized',
    msg: 'You must complete identity verification before requesting a loan.',
    desc: 'Unable to access loan creation as identity documents are yet to be submitted',
  })
  @ApiGenericErrorResponse({
    code: 401,
    err: 'Unauthorized',
    msg: 'Identity verification is still pending. You cannot request a loan until it is verified.',
    desc: 'Unable to access loan creation as identity documents are yet to be verified',
  })
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    msg: 'You need to have added a payment method in order to apply for a loan.',
    desc: 'Unable to access loan creation as no payment method was found',
  })
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    msg: 'You need to have added your payroll data in order to apply for a loan.',
    desc: 'Unable to access loan creation as no payroll data was found',
  })
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    msg: 'Interest rate or management fee rate is not set. Please contact support.',
    desc: 'Unable to access loan creation as interest rate or management fee rate is not set',
  })
  @ApiUserUnauthorizedResponse()
  async applyLoan(@Req() req: Request, @Body() dto: CreateLoanDto) {
    const { userId } = req.user as AuthUser;
    return this.loanService.requestCashLoan(userId, dto);
  }

  @Post('commodity')
  @ApiOperation({
    summary: 'Request a commodity loan',
    description:
      'Create a commodity loan request via this endpoint! requires the set assetName to exist in the config list of commodities',
  })
  @ApiBody({
    type: UserCommodityLoanRequestDto,
    description: 'Name of asset to request loan for',
  })
  @ApiResponse({
    status: 201,
    description: 'Commodity Loan application success response',
    schema: {
      example: {
        message:
          'You have successfully requested a commodity loan for a laptop! Please keep an eye out for communicqation lines from our support',
      },
    },
  })
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    msg: 'No commodities are in the inventory',
    desc: 'Admins are yet to set the categories of commodities here!',
  })
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    msg: 'Only commodities in stock can be requested.',
    desc: 'The asset name provided, does not exists or match with any of the supported categories of commodities on the platform',
  })
  @ApiUserUnauthorizedResponse()
  async requestCommodityLoan(
    @Req() req: Request,
    @Body() dto: UserCommodityLoanRequestDto,
  ) {
    const { userId } = req.user as AuthUser;
    return this.loanService.requestAssetLoan(userId, dto.assetName);
  }

  @Get('commodity')
  @ApiOperation({
    summary: 'Get commodity loan history',
    description:
      'Returns paginated commodity loan request history sorted by creation date',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiOkPaginatedResponse(AllCommodityLoansDto)
  @ApiUserUnauthorizedResponse()
  getCommodityLoanHistory(
    @Req() req: Request,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const { userId } = req.user as AuthUser;
    return this.loanService.getCommodityLoanRequestHistory(
      userId,
      +limit,
      +page,
    );
  }

  @Get('commodity/:cLoanId')
  @ApiOperation({ summary: 'Fetch a commodity loan by its ID' })
  @ApiOkBaseResponse(CommodityLoanDataDto)
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    msg: 'Commodity Loan with the provided ID could not be found. Please check and try again',
    desc: 'Unable to find the loan from the ID provided',
  })
  @ApiUserUnauthorizedResponse()
  getCommodityLoanById(@Param('cLoanId') cLoanId: string, @Req() req: Request) {
    const { userId } = req.user as AuthUser;
    return this.loanService.getAssetLoanById(userId, cLoanId);
  }

  @Get(':loanId')
  @ApiOperation({ summary: 'Fetch a loan by its ID' })
  @ApiOkBaseResponse(LoanDataDto)
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    msg: 'Loan with the provided ID could not be found. Please check and try again',
    desc: 'Unable to find the loan from the ID provided',
  })
  @ApiUserUnauthorizedResponse()
  getLoanById(@Param('loanId') loanId: string, @Req() req: Request) {
    const { userId } = req.user as AuthUser;
    return this.loanService.getLoanById(userId, loanId);
  }

  @Put(':loanId')
  @ApiOperation({
    summary: 'Update an existing loan',
    description: 'Update an existing loan which is still in a pending status',
  })
  @ApiBody({ type: UpdateLoanDto, description: 'Loan data to be updated' })
  @ApiResponse({
    status: 200,
    description: 'Loan application update',
    schema: {
      example: {
        message: 'Loan application updated successfully',
      },
    },
  })
  @ApiGenericErrorResponse({
    code: 401,
    err: 'Unauthorized',
    msg: 'Identity verification is still pending. You cannot update a loan until it is verified.',
    desc: 'Unable to update loan as identity documents are yet to be verified',
  })
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    msg: 'Loan with the provided ID could not be found. Please check and try again',
    desc: 'Unable to find the loan from the ID provided',
  })
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    msg: 'Only pending loans can be modified.',
    desc: 'Loan has left a status of PENDING to be updated',
  })
  @ApiUserUnauthorizedResponse()
  async updateLoan(
    @Param('loanId') loanId: string,
    @Req() req: Request,
    @Body() dto: UpdateLoanDto,
  ) {
    const { userId } = req.user as AuthUser;
    return this.loanService.updateLoan(userId, loanId, dto);
  }

  @Delete(':loanId')
  @ApiOperation({ summary: 'Delete a pending loan request' })
  @ApiSuccessResponse('Loan deleted successfully', null)
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    msg: 'Loan with the provided ID could not be found. Please check and try again',
    desc: 'Unable to find the loan from the ID provided',
  })
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    msg: 'Only pending loans can be modified.',
    desc: 'Loan has left a status of PENDING to be deleted',
  })
  @ApiUserUnauthorizedResponse()
  deleteLoan(@Param('loanId') loanId: string, @Req() req: Request) {
    const { userId } = req.user as AuthUser;
    return this.loanService.deleteLoan(userId, loanId);
  }
}
