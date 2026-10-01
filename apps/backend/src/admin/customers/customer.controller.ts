import { applyDecorators, Body, Controller, Get, Param, Patch, Post, Query, type Type } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Access, CurrentUser } from 'src/auth/decorators';
import {
  ApiDtoErrorResponse,
  ApiGenericErrorResponse,
  ApiNullOkResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import { BaseResponseDto, MetaDto } from 'src/common/dto/generic.dto';
import type { AuthUser } from 'src/common/types';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import {
  CustomerLiquidationQueryDto,
  CustomerLoanStatementQueryDto,
  CustomerLoanTopupDto,
  CustomerRepaymentsQueryDto,
  CustomerTenureChangeQueryDto,
  CustomerTopupHistoryQueryDto,
  GenerateCustomerLoanReportDto,
  SendMessageDto,
  UpdateCustomerStatusDto,
} from '../common/dto/customer.dto';
import {
  CustomerIdentityDto,
  CustomerInfoDto,
  CustomerLoansDto,
  CustomerLoanStatementDto,
  CustomerLoanSummaryDto,
  CustomerPaymentMethodDto,
  CustomerPayrollDto,
  CustomerPPIDto,
  CustomerRepaymentDto,
  CustomerTenureChangeDto,
  CustomerTopupHistoryItemDto,
  CustomerTopupRequestResultDto,
} from '../common/entities/customer.entities';
import { ActiveLoanDto } from '../common/entities/loan.entities';
import { CustomerLiquidationRequestsDto } from '../common/entities/repayment.entity';
import { CUSTOMER_NOT_FOUND, CustomerService } from './customer.service';

/** `{ data: Model, meta, message }`: one object whose list inside is paged. */
function ApiOkPagedObjectResponse(model: Type<unknown>) {
  return applyDecorators(
    ApiExtraModels(BaseResponseDto, MetaDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseDto) },
          { properties: { data: { $ref: getSchemaPath(model) }, meta: { $ref: getSchemaPath(MetaDto) } } },
        ],
      },
    }),
  );
}

const ApiCustomerParam = () => ApiParam({ name: 'id', description: 'Customer (user) id', example: 'MB-HOWP2' });
const ApiCustomerNotFound = () =>
  ApiGenericErrorResponse({ desc: 'No such customer', err: 'Not Found', msg: CUSTOMER_NOT_FOUND, code: 404 });

// Every route: ADMIN, SUPER_ADMIN and MARKETER, as in v1. Activating or deactivating a customer
// is further limited to SUPER_ADMIN, and a marketer tops up only customers they onboarded (both
// checked in the service).
@ApiTags('Admin:Customer Page')
@Access('ADMIN', 'SUPER_ADMIN', 'MARKETER')
@Controller('admin/customer')
export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  @Get(':id')
  @ApiOperation({ summary: "A customer's profile, status and repayment rate" })
  @ApiCustomerParam()
  @ApiOkBaseResponse(CustomerInfoDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getInfo(@Param('id') id: string) {
    const data = await this.service.getInfo(id);
    return { data, message: 'Customer has been successfully queried' };
  }

  @Get(':id/loans')
  @ApiOperation({
    summary: 'Running loan and open applications',
    description:
      'The running loan with its figures, and everything waiting: new loan requests (PENDING/APPROVED), top-ups (PENDING/APPROVED) and asset top-up requests in review.',
  })
  @ApiCustomerParam()
  @ApiOkBaseResponse(CustomerLoansDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getLoans(@Param('id') id: string) {
    const data = await this.service.getLoans(id);
    return { data, message: "Customer's running loan and applications have been successfully queried" };
  }

  @Get(':id/summary')
  @ApiOperation({ summary: "Totals over the customer's disbursed and repaid loans, from the ledger" })
  @ApiCustomerParam()
  @ApiOkBaseResponse(CustomerLoanSummaryDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getSummary(@Param('id') id: string) {
    const data = await this.service.getSummary(id);
    return { data, message: 'Customer loan summary retrieved' };
  }

  @Get(':id/topups')
  @ApiOperation({
    summary: "Top-ups on the customer's loans",
    description: 'Cash and asset top-ups, newest first; an asset top-up request still in review is listed as PENDING.',
  })
  @ApiCustomerParam()
  @ApiOkPaginatedResponse(CustomerTopupHistoryItemDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getTopups(@Param('id') id: string, @Query() query: CustomerTopupHistoryQueryDto) {
    const result = await this.service.getTopups(id, query);
    return { ...result, message: 'Top-up history retrieved successfully' };
  }

  @Get(':id/tenure-changes')
  @ApiOperation({ summary: "Tenure changes on the customer's loans, newest first" })
  @ApiCustomerParam()
  @ApiOkPaginatedResponse(CustomerTenureChangeDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getTenureChanges(@Param('id') id: string, @Query() query: CustomerTenureChangeQueryDto) {
    const result = await this.service.getTenureChanges(id, query);
    return { ...result, message: 'Tenure-change history retrieved successfully' };
  }

  @Get(':id/loan-statement')
  @ApiOperation({
    summary: 'Loan account statement (admin copy)',
    description:
      'Ledger lines (disbursements, interest, penalties, repayments with their split) over every disbursed loan, oldest first, with a running balance. `from` defaults to the month of the first disbursement, `to` to the current month (Lagos). Totals cover the whole range; `lines` is paged.',
  })
  @ApiCustomerParam()
  @ApiOkPagedObjectResponse(CustomerLoanStatementDto)
  @ApiDtoErrorResponse('`from` must not be after `to`')
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getLoanStatement(@Param('id') id: string, @Query() query: CustomerLoanStatementQueryDto) {
    const result = await this.service.getLoanStatement(id, query);
    return { ...result, message: 'Loan account statement retrieved successfully' };
  }

  @Get(':id/repayments')
  @ApiOperation({
    summary: 'Payments received for the customer',
    description: 'Payroll rows and liquidations, newest payroll month first, with what each paid on the loan.',
  })
  @ApiCustomerParam()
  @ApiOkPaginatedResponse(CustomerRepaymentDto)
  @ApiDtoErrorResponse('`from` must not be after `to`')
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getRepayments(@Param('id') id: string, @Query() query: CustomerRepaymentsQueryDto) {
    const result = await this.service.getRepayments(id, query);
    return { ...result, message: 'Repayment history fetched successfully' };
  }

  @Get(':id/ppi-info')
  @ApiOperation({ summary: 'Payroll, identity and bank details (with BVN) in one call' })
  @ApiCustomerParam()
  @ApiOkBaseResponse(CustomerPPIDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getPPI(@Param('id') id: string) {
    const data = await this.service.getPPI(id);
    return { data, message: 'Customer has been successfully queried' };
  }

  @Get(':id/payment-method')
  @ApiOperation({ summary: "The customer's bank details; data is null when there are none" })
  @ApiCustomerParam()
  @ApiOkBaseResponse(CustomerPaymentMethodDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getPaymentMethod(@Param('id') id: string) {
    const data = await this.service.getPaymentMethod(id);
    return { data, message: data ? 'Payment methods have been successfully queried' : 'No payment method found' };
  }

  @Get(':id/identity')
  @ApiOperation({ summary: "The customer's identity details; data is null when there are none" })
  @ApiCustomerParam()
  @ApiOkBaseResponse(CustomerIdentityDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getIdentity(@Param('id') id: string) {
    const data = await this.service.getIdentity(id);
    return {
      data,
      message: data
        ? 'Identity information for the user has been retrieved successfully'
        : 'Identity information not found for this user',
    };
  }

  @Get(':id/payroll')
  @ApiOperation({ summary: "The customer's payroll record; data is null when there is none" })
  @ApiCustomerParam()
  @ApiOkBaseResponse(CustomerPayrollDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getPayroll(@Param('id') id: string) {
    const data = await this.service.getPayroll(id);
    return { data, message: data ? 'User payroll data found' : 'User payroll data not found' };
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: "Change a customer's status",
    description:
      'FLAGGED needs a reason (it becomes the flag reason; ADMIN, SUPER_ADMIN and MARKETER may flag). ACTIVE and INACTIVE are SUPER_ADMIN only; ACTIVE clears the flag reason, INACTIVE signs the customer out everywhere. Audited with the reason.',
  })
  @ApiCustomerParam()
  @ApiNullOkResponse('Status updated', "John Doe's account is now flagged")
  @ApiDtoErrorResponse('Give a reason for flagging this account')
  @ApiGenericErrorResponse({
    desc: 'Only a super admin activates or deactivates',
    err: 'Forbidden',
    msg: 'Only a super admin can activate or deactivate a customer',
    code: 403,
  })
  @ApiCustomerNotFound()
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateCustomerStatusDto, @CurrentUser() user: AuthUser) {
    const message = await this.service.updateStatus(id, dto, user);
    return { data: null, message };
  }

  @Post(':id/message')
  @ApiOperation({ summary: 'Send the customer an in-app message' })
  @ApiCustomerParam()
  @ApiNullOkResponse('Message sent', 'Message sent to John Doe as an in-app notification', true)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto) {
    const message = await this.service.messageUser(id, dto);
    return { data: null, message };
  }

  @Get(':id/liquidation-requests')
  @ApiOperation({ summary: "The customer's liquidation requests, newest first" })
  @ApiCustomerParam()
  @ApiOkPaginatedResponse(CustomerLiquidationRequestsDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getLiquidationRequests(@Param('id') id: string, @Query() query: CustomerLiquidationQueryDto) {
    const result = await this.service.getLiquidationRequests(id, query);
    return { ...result, message: 'Liquidation requests retrieved successfully' };
  }

  @Post(':id/generate-report')
  @ApiOperation({
    summary: 'Email a customer loan report (admin copy)',
    description:
      "Queued; the report goes to `email`, or to the requesting admin's email when it is left out. `from`/`to` (YYYY-MM) limit it to those payroll months; the whole history when absent.",
  })
  @ApiCustomerParam()
  @ApiNullOkResponse('Report queued', 'The report is being generated and will be sent to admin@example.com', true)
  @ApiDtoErrorResponse([
    'Enter an email address to send the report to: your account has none',
    'This customer has no disbursed loan to report on',
  ])
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async generateReport(
    @Param('id') id: string,
    @Body() dto: GenerateCustomerLoanReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    const message = await this.service.generateReport(id, dto, user);
    return { data: null, message };
  }

  @Get(':id/active-loan')
  @ApiOperation({ summary: "The customer's running (DISBURSED) loan with its figures; data is null when there is none" })
  @ApiCustomerParam()
  @ApiOkBaseResponse(ActiveLoanDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getActiveLoan(@Param('id') id: string) {
    const data = await this.service.getActiveLoan(id);
    return { data, message: data ? 'Active loan found' : 'This customer has no running loan' };
  }

  @Post(':id/loan-topup')
  @ApiOperation({
    summary: 'Request a top-up on the running loan for the customer',
    description:
      'Cash (any category but ASSET_PURCHASE; `cashLoan.amount`, optional `monthsDelta`): a PENDING top-up, decided on /admin/loans/topups. Asset (`commodityLoan.assetName`, an active commodity): a request in review, priced on /admin/loans/commodity (monthsDelta is set there). A MARKETER can only top up customers they onboarded.',
  })
  @ApiCustomerParam()
  @ApiCreatedResponse({
    description: 'Top-up requested',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        { properties: { data: { $ref: getSchemaPath(CustomerTopupRequestResultDto) } } },
      ],
    },
  })
  @ApiExtraModels(BaseResponseDto, CustomerTopupRequestResultDto)
  @ApiDtoErrorResponse([
    'Enter the top-up amount (cashLoan.amount)',
    "A top-up keeps the loan's tenure: send monthsDelta to change it",
    'Laptop is not an available commodity. Choose one from the commodities list.',
  ])
  @ApiGenericErrorResponse({
    desc: 'No running loan, or a top-up / asset request is already waiting',
    err: 'Conflict',
    msg: 'This loan already has a top-up waiting for a decision',
    code: 409,
  })
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  loanTopup(@Param('id') id: string, @Body() dto: CustomerLoanTopupDto, @CurrentUser() user: AuthUser) {
    return this.service.loanTopup(id, dto, user);
  }
}
