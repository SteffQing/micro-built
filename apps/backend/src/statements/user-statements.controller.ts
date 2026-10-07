import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerLoanStatementDto } from 'src/admin/common/entities/customer.entities';
import { Access, CurrentUser } from 'src/auth/decorators';
import {
  ApiDtoErrorResponse,
  ApiGenericErrorResponse,
  ApiOkBaseResponse,
  ApiOkPagedObjectResponse,
} from 'src/common/decorators';
import type { AuthUser } from 'src/common/types';
import { DocumentJobDto, StatementQueryDto, UserDocumentRequestDto } from './statements.dto';
import { NO_LOAN_TO_REPORT, StatementsService } from './statements.service';

const NO_LOAN = { code: 400, err: 'Bad Request', msg: NO_LOAN_TO_REPORT, desc: 'No loan was ever disbursed' };

@ApiTags('User Statements')
@Access('CUSTOMER')
@Controller('user')
export class UserStatementsController {
  constructor(private readonly statements: StatementsService) {}

  @Get('statement')
  @ApiOperation({
    summary: 'Loan account statement, on screen',
    description:
      'Disbursements, interest, penalties and repayments over every disbursed loan, oldest first, with a running ' +
      'balance. `from` defaults to the first disbursement month, `to` to this month. Totals cover the whole range; ' +
      '`lines` is paged.',
  })
  @ApiOkPagedObjectResponse(CustomerLoanStatementDto)
  @ApiDtoErrorResponse('`from` must not be after `to`')
  async statement(@CurrentUser() user: AuthUser, @Query() query: StatementQueryDto) {
    const result = await this.statements.page(user.userId, query, 'customer');
    return { ...result, message: 'Statement retrieved successfully' };
  }

  @Post('statement')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Statement as a file (PDF or XLSX)',
    description: 'Queued; the download link arrives as a notification, and by email when you have one.',
  })
  @ApiOkBaseResponse(DocumentJobDto)
  @ApiGenericErrorResponse(NO_LOAN)
  async statementFile(@CurrentUser() user: AuthUser, @Body() dto: UserDocumentRequestDto) {
    const data = await this.statements.request(user.userId, 'statement', dto, user, 'customer');
    return { data, message: 'Your statement is being prepared. You will get a link when it is ready.' };
  }

  @Post('report')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Loan report as a file (PDF or XLSX): a summary of your loans plus the statement',
    description: 'Queued; the download link arrives as a notification, and by email when you have one.',
  })
  @ApiOkBaseResponse(DocumentJobDto)
  @ApiGenericErrorResponse(NO_LOAN)
  async reportFile(@CurrentUser() user: AuthUser, @Body() dto: UserDocumentRequestDto) {
    const data = await this.statements.request(user.userId, 'report', dto, user, 'customer');
    return { data, message: 'Your report is being prepared. You will get a link when it is ready.' };
  }
}
