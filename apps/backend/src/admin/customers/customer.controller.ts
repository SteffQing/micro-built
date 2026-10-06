import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
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
  ApiOkPagedObjectResponse,
} from 'src/common/decorators';
import { BaseResponseDto } from 'src/common/dto/generic.dto';
import type { AuthUser } from 'src/common/types';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import {
  CustomerLiquidationQueryDto,
  CustomerLoanStatementQueryDto,
  CustomerLoanTopupDto,
  CustomerRepaymentsQueryDto,
  CustomerTenureChangeQueryDto,
  CustomerTopupHistoryQueryDto,
  SendMessageDto,
  AssignAccountOfficerDto,
  OnboardPayrollDto,
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
import { CustomerDetailsService } from './customer-details.service';
import { ChangeRequestDto } from 'src/change-requests/change-requests.dto';
import { UpdateIdentityDto } from 'src/user/common/dto/identity.dto';
import { UpdatePaymentMethodDto } from 'src/user/common/dto/payment-method.dto';
import { AdminDocumentRequestDto, DocumentJobDto, ReportPreviewQueryDto } from 'src/statements/statements.dto';
import { CustomerReportDto } from 'src/documents/customer-report.dto';
import { CustomerReportService } from 'src/documents/customer-report.service';
import { NO_LOAN_TO_REPORT, StatementsService } from 'src/statements/statements.service';
import { LiquidationRequestsService, PROOF_LINK_SECONDS } from 'src/liquidations/liquidation-requests.service';
import {
  CreateLiquidationDto,
  LiquidationCreatedDto,
  LiquidationPreviewDto,
  ProofUpload,
  ProofUrlDto,
} from 'src/liquidations/liquidations.dto';

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
  constructor(
    private readonly service: CustomerService,
    private readonly liquidations: LiquidationRequestsService,
    private readonly statements: StatementsService,
    private readonly reports: CustomerReportService,
    private readonly details: CustomerDetailsService,
  ) {}

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
    await this.service.assertCustomer(id);
    const result = await this.statements.page(id, query, 'admin');
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
  @ApiOperation({ summary: 'Payroll, identity and bank details in one call (the BVN for super admins only)' })
  @ApiCustomerParam()
  @ApiOkBaseResponse(CustomerPPIDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async getPPI(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const data = await this.service.getPPI(id, user.role === 'SUPER_ADMIN');
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

  @Post(':id/payroll')
  @Access('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Propose payroll data for a customer who has none',
    description:
      'Same fields as onboarding: `externalId` (IPPIS), `command`, `organization`, `grade?`, `step?`. Nothing is written: ' +
      'a PAYROLL change request waits for a super admin. Only while the customer has no payroll on file ' +
      '(409 otherwise: it then changes only through payroll uploads); 409 when the IPPIS number belongs to another customer.',
  })
  @ApiCustomerParam()
  @ApiOkBaseResponse(ChangeRequestDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  proposePayroll(@Param('id') id: string, @Body() dto: OnboardPayrollDto, @CurrentUser() user: AuthUser) {
    return this.details.proposePayroll(id, dto, user.userId);
  }

  @Patch(':id/identity')
  @Access('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Propose a change to the customer's identity details",
    description:
      'Nothing is written: an IDENTITY change request (proposed by you) waits for a super admin; the ' +
      'customer is told. With no identity on file every field is required (approving creates it). data is null when ' +
      'nothing differs; 409 while the customer has their own request of this kind waiting.',
  })
  @ApiCustomerParam()
  @ApiBody({ type: UpdateIdentityDto })
  @ApiOkBaseResponse(ChangeRequestDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  proposeIdentity(@Param('id') id: string, @Body() dto: UpdateIdentityDto, @CurrentUser() user: AuthUser) {
    return this.details.proposeIdentity(id, dto, user.userId);
  }

  @Patch(':id/payment-method')
  @Access('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Propose a change to the customer's bank details",
    description:
      'As identity: a PAYMENT_METHOD change request a super admin decides. With none on file, bankName, ' +
      'accountNumber, accountName and bvn are all required. 409 when the account number or BVN belongs to another customer.',
  })
  @ApiCustomerParam()
  @ApiBody({ type: UpdatePaymentMethodDto })
  @ApiOkBaseResponse(ChangeRequestDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  proposePaymentMethod(@Param('id') id: string, @Body() dto: UpdatePaymentMethodDto, @CurrentUser() user: AuthUser) {
    return this.details.proposePaymentMethod(id, dto, user.userId);
  }

  @Patch(':id/account-officer')
  @Access('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Assign the customer to an account officer',
    description:
      "SUPER_ADMIN only. `accountOfficerId` is an admin's user id, or `microbuilt-system-id` to hand the customer back to " +
      'the platform (self-signed). Audited as CUSTOMER_OFFICER_CHANGED with "from → to".',
  })
  @ApiCustomerParam()
  @ApiNullOkResponse('Officer assigned', 'John Doe is now with Jane Admin')
  @ApiGenericErrorResponse({ code: 404, err: 'Not Found', msg: 'Account officer not found', desc: 'Unknown admin id' })
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async assignAccountOfficer(
    @Param('id') id: string,
    @Body() dto: AssignAccountOfficerDto,
    @CurrentUser() user: AuthUser,
  ) {
    const message = await this.service.assignAccountOfficer(id, dto, user);
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
    await this.service.assertCustomer(id);
    const { items, meta } = await this.liquidations.history(id, query.page, query.limit, query.state);
    return { data: items, meta, message: 'Liquidation requests retrieved successfully' };
  }

  @Get(':id/liquidation-preview')
  @ApiOperation({ summary: "What paying off the customer's loan would take now, split by component" })
  @ApiCustomerParam()
  @ApiOkBaseResponse(LiquidationPreviewDto)
  @ApiGenericErrorResponse({ code: 409, err: 'Conflict', msg: 'There is no active loan to liquidate', desc: 'No loan' })
  @ApiRoleForbiddenResponse()
  async liquidationPreview(@Param('id') id: string) {
    await this.service.assertCustomer(id);
    const data = await this.liquidations.preview(id);
    return { data, message: 'Liquidation preview retrieved successfully' };
  }

  @Post(':id/request-liquidation')
  @Access('ADMIN', 'SUPER_ADMIN')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Record a liquidation the customer paid, with proof, for a super admin to approve',
    description: 'Multipart, sent direct to the API: `amount` and `proof` (PDF, JPG or PNG, at most 5 MB).',
  })
  @ApiCustomerParam()
  @ProofUpload()
  @ApiOkBaseResponse(LiquidationCreatedDto)
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async requestLiquidation(
    @Param('id') id: string,
    @Body() dto: CreateLiquidationDto,
    @UploadedFile() proof: Express.Multer.File | undefined,
  ) {
    await this.service.assertCustomer(id);
    const data = await this.liquidations.create(id, dto.amount, proof);
    return { data, message: 'Liquidation request submitted for approval' };
  }

  @Get(':id/liquidation-requests/:requestId/proof')
  @ApiOperation({ summary: 'A short-lived link to the proof sent with a liquidation request' })
  @ApiCustomerParam()
  @ApiOkBaseResponse(ProofUrlDto)
  @ApiGenericErrorResponse({ code: 404, err: 'Not Found', msg: 'Liquidation request not found', desc: 'Unknown id' })
  @ApiRoleForbiddenResponse()
  async liquidationProof(@Param('id') id: string, @Param('requestId') requestId: string) {
    const url = await this.liquidations.proofUrl(requestId, id);
    return { data: { url, expiresIn: PROOF_LINK_SECONDS }, message: 'Proof link created' };
  }

  @Post(':id/statement')
  @HttpCode(202)
  @ApiOperation({
    summary: "The customer's statement as a file (PDF or XLSX)",
    description:
      "Queued; the link reaches you in-app, and by email at `email` or your own address. `audience` picks the copy: " +
      "`admin` (default) or exactly the customer's own.",
  })
  @ApiCustomerParam()
  @ApiOkBaseResponse(DocumentJobDto)
  @ApiGenericErrorResponse({ code: 400, err: 'Bad Request', msg: NO_LOAN_TO_REPORT, desc: 'Nothing disbursed yet' })
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async statementFile(@Param('id') id: string, @Body() dto: AdminDocumentRequestDto, @CurrentUser() user: AuthUser) {
    await this.service.assertCustomer(id);
    const data = await this.statements.request(id, 'statement', dto, user, dto.audience ?? 'admin');
    return { data, message: 'The statement is being prepared. You will get a link when it is ready.' };
  }

  @Get(':id/report-preview')
  @ApiOperation({
    summary: 'What the report holds, as JSON (no file)',
    description:
      "`audience=customer` is exactly the customer's copy; `admin` (default) adds revenue, private commodity " +
      'details, the account officer and internal notes. Same range defaults as the statement.',
  })
  @ApiCustomerParam()
  @ApiOkBaseResponse(CustomerReportDto)
  @ApiDtoErrorResponse('`from` must not be after `to`')
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async reportPreview(@Param('id') id: string, @Query() query: ReportPreviewQueryDto) {
    const data = await this.reports.build(id, query.audience ?? 'admin', { from: query.from, to: query.to });
    return { data, message: 'Report preview retrieved successfully' };
  }

  @Post(':id/report')
  @HttpCode(202)
  @ApiOperation({
    summary: 'A loan report as a file (PDF or XLSX): summary + statement',
    description:
      'Queued like the statement. The admin copy adds interest booked/collected, management fee, penalty revenue, ' +
      'private commodity details, the account officer and internal notes.',
  })
  @ApiCustomerParam()
  @ApiOkBaseResponse(DocumentJobDto)
  @ApiGenericErrorResponse({ code: 400, err: 'Bad Request', msg: NO_LOAN_TO_REPORT, desc: 'Nothing disbursed yet' })
  @ApiCustomerNotFound()
  @ApiRoleForbiddenResponse()
  async reportFile(@Param('id') id: string, @Body() dto: AdminDocumentRequestDto, @CurrentUser() user: AuthUser) {
    await this.service.assertCustomer(id);
    const data = await this.statements.request(id, 'report', dto, user, dto.audience ?? 'admin');
    return { data, message: 'The report is being prepared. You will get a link when it is ready.' };
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
      "`kind` CASH (`cashLoan.amount`, optional `monthsDelta` ≥ 1): a PENDING top-up, decided on /admin/loans/topups. `kind` ASSET (`commodityLoan.assetName`, an active commodity): a request in review, priced on /admin/loans/commodity (monthsDelta is set there). No category: the top-up takes the running loan's. A MARKETER can only top up customers they onboarded.",
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
