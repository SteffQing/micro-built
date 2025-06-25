import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
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
  CreateLoanDto,
  LoanDataDto,
  LoanHistoryResponseDto,
  PendingLoanAndLoanCountResponseDto,
  UpdateLoanDto,
} from '../common/dto';
import { ApiUserUnauthorizedResponse } from '../common/decorators';
import {
  ApiGenericErrorResponse,
  ApiOkResponseWith,
  ApiSuccessResponse,
} from 'src/common/decorators';

@ApiTags('User Loan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/loan')
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get pending loans and loan status counts',
    description:
      'Returns list of pending loan requests and count of approved, rejected, and disbursed loans',
  })
  @ApiOkResponse({
    description:
      'User pending loans and counts of approved/rejected/disbursed loans',
    type: PendingLoanAndLoanCountResponseDto,
  })
  @ApiUserUnauthorizedResponse()
  getPendingLoans(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    return this.loanService.getPendingLoansAndLoanCount(userId);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get loan history',
    description:
      'Returns paginated loan request history sorted by creation date',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiOkResponse({
    description: 'Paginated loan request history',
    type: LoanHistoryResponseDto,
  })
  @ApiUserUnauthorizedResponse()
  getLoanHistory(
    @Req() req: Request,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const { userId } = req.user as AuthUser;
    return this.loanService.getLoanRequestHistory(userId, +limit, +page);
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
          repayable: 110000,
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
  @ApiUserUnauthorizedResponse()
  async applyLoan(@Req() req: Request, @Body() dto: CreateLoanDto) {
    const { userId } = req.user as AuthUser;
    return this.loanService.applyForLoan(userId, dto);
  }

  @Patch()
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
        data: {
          repayable: 110000,
        },
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
  async updateLoan(@Req() req: Request, @Body() dto: UpdateLoanDto) {
    const { userId } = req.user as AuthUser;
    return this.loanService.updateLoan(userId, dto);
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

  @Get(':loanId')
  @ApiOperation({ summary: 'Fetch a loan by its ID' })
  @ApiOkResponseWith(LoanDataDto, 'Loan details retrieved successfully')
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
}
