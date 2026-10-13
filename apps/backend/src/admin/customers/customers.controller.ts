import {
  applyDecorators,
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Logger,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  type Type,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Access, Confirm, CurrentUser, Roles } from 'src/auth/decorators';
import {
  ApiDtoErrorResponse,
  ApiGenericErrorResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import { BaseResponseDto } from 'src/common/dto/generic.dto';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import type { AuthUser } from 'src/common/types';
import { IMPORTS_BUCKET } from 'src/audit/audit.files';
import { AuditService } from 'src/audit/audit.service';
import { requestOrigin } from 'src/audit/request-origin';
import { captureJobError } from 'src/common/observability';
import { generateId } from 'src/common/utils';
import { SupabaseService } from 'src/database/supabase.service';
import { QueueProducer } from 'src/queue/bull/queue.producer';
import { RATES_NOT_SET } from 'src/settings/settings.service';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { CustomersQueryDto, OnboardCustomer } from '../common/dto/customer.dto';
import {
  AccountOfficerListItemDto,
  AccountOfficerStatsDto,
  CustomerListItemDto,
  CustomersOverviewDto,
  OnboardedCustomerDto,
} from '../common/entities/customers.entities';
import { CustomersService } from './customers.service';

/** `{ data: Model[], message }`. */
function ApiOkArrayResponse(model: Type<unknown>) {
  return applyDecorators(
    ApiExtraModels(BaseResponseDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseDto) },
          { properties: { data: { type: 'array', items: { $ref: getSchemaPath(model) } } } },
        ],
      },
    }),
  );
}

const EXCEL_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];

@ApiTags('Admin:Customers Page')
@Access('ADMIN', 'SUPER_ADMIN')
@Controller('admin/customers')
export class CustomersController {
  constructor(
    private readonly service: CustomersService,
    private readonly queue: QueueProducer,
    private readonly audit: AuditService,
    private readonly supabase: SupabaseService,
  ) {}

  private readonly logger = new Logger(CustomersController.name);

  @Get('overview')
  @ApiOperation({
    summary: 'Customer cards',
    description:
      'Account-status counts, customers with a running loan, and how borrowers did in the latest closed payroll month (each counted once by their worst deduction: FAILED > PARTIAL > FULFILLED).',
  })
  @ApiOkBaseResponse(CustomersOverviewDto)
  @ApiRoleForbiddenResponse()
  async getOverview() {
    const data = await this.service.getOverview();
    return { data, message: 'Customers overview fetched successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'Customers, filtered and paginated, with their repayment rate' })
  @ApiOkPaginatedResponse(CustomerListItemDto)
  @ApiRoleForbiddenResponse()
  async getCustomers(@Query() query: CustomersQueryDto) {
    const result = await this.service.getCustomers(query);
    return { ...result, message: 'Customers table has been successfully queried' };
  }

  @Post()
  @Confirm('window')
  @Roles('ADMIN', 'SUPER_ADMIN', 'MARKETER')
  @ApiOperation({
    summary: 'Onboard a new customer',
    description:
      'Creates the account (password sign-in; the phone number counts as verified), identity, bank details, payroll and an optional first loan in one go. A cash loan is approved at once with the rates in Settings and waits for disbursement; an asset loan goes to review. A customer onboarded by a MARKETER starts FLAGGED until an admin activates them. A customer with an email gets their password by email; a phone-only customer gets an SMS telling them to sign in with their phone number.',
  })
  @ApiCreatedResponse({
    description: 'Customer onboarded',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        { properties: { data: { $ref: getSchemaPath(OnboardedCustomerDto) } } },
      ],
    },
  })
  @ApiExtraModels(BaseResponseDto, OnboardedCustomerDto)
  @ApiDtoErrorResponse("Enter the customer's email or phone number")
  @ApiGenericErrorResponse({
    desc: 'Already registered, or rates not set when a loan is included',
    code: 409,
    err: 'Conflict',
    msg: `A customer with this IPPIS number already exists | ${RATES_NOT_SET}`,
  })
  @ApiRoleForbiddenResponse()
  addCustomer(@CurrentUser() user: AuthUser, @Body() dto: OnboardCustomer) {
    return this.service.addCustomer(dto, user.userId, user.role);
  }

  @Post('upload-existing')
  @Confirm('action')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Upload existing customers',
    description:
      'An Excel sheet of customers who already have running loans. The layout is checked now; the rows are imported in the background and the uploader gets a summary (in-app and email). ' +
      'Audited from upload to result under the import reference (CUSTOMER_IMPORT): the upload (file, hash, rows, IP; the sheet is kept), every customer it onboarded, and the outcome.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary', description: 'Excel spreadsheet (.xlsx, .xls)' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({
    description: 'File validated and queued; `data.importId` names the import in the audit log',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        { properties: { data: { type: 'object', properties: { importId: { type: 'string', example: 'IMP-7Q2LX0' } } } } },
      ],
    },
  })
  @ApiDtoErrorResponse(['No file provided', 'Invalid file type. Only Excel files (.xlsx, .xls) are allowed'])
  @ApiRoleForbiddenResponse()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (EXCEL_TYPES.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Invalid file type. Only Excel files (.xlsx, .xls) are allowed'), false);
      },
    }),
  )
  async uploadFile(@CurrentUser() user: AuthUser, @Req() request: Request, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const importId = generateId.importId();
    const queued = await this.queue.addExistingCustomers({ file, requestedById: user.userId, importId });
    // Kept so the audit log can show exactly what was uploaded. The import doesn't need it (the job has the rows),
    // so a storage failure is reported and the entry says the sheet wasn't kept.
    const storedPath = `${importId}/${file.originalname.replace(/[\\/]/g, '_')}`;
    const stored = await this.supabase.uploadPrivate(IMPORTS_BUCKET, storedPath, file.buffer, file.mimetype).then(
      () => true,
      (error: unknown) => {
        this.logger.error(`Keeping import sheet ${importId} failed`, error instanceof Error ? error.stack : error);
        captureJobError(error, { job: 'import-sheet-store' });
        return false;
      },
    );
    await this.audit.record({
      actorId: user.userId,
      action: 'CUSTOMERS_IMPORTED',
      entityType: 'CUSTOMER_IMPORT',
      entityId: importId,
      note: `"${file.originalname}" uploaded: ${queued.dataRows} rows queued for import`,
      meta: {
        importId,
        fileName: file.originalname,
        fileSize: file.size,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        sheet: queued.sheetName,
        headerRow: queued.headerRow,
        dataRows: queued.dataRows,
        columns: queued.columns,
        storedFile: stored ? { bucket: IMPORTS_BUCKET, path: storedPath } : null,
        ...requestOrigin(request),
      },
    });
    return {
      data: { importId },
      message: `File validated (import ${importId}). The customers are being imported; you will get a summary when it finishes.`,
    };
  }
}

@ApiTags('Admin:Account Officers')
@Access('ADMIN', 'SUPER_ADMIN')
@Controller('admin/account-officer')
export class AccountOfficerController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @ApiOperation({
    summary: 'Account officers',
    description:
      'Every admin (removed ones too, they keep their customers) with how many customers they onboarded, plus a `microbuilt-system-id` entry for self sign-ups.',
  })
  @ApiOkArrayResponse(AccountOfficerListItemDto)
  @ApiRoleForbiddenResponse()
  async getAccountOfficers() {
    const data = await this.service.getAccountOfficers();
    return { data, message: 'Account officers' };
  }

  // Declared before `:id/...` so `me` isn't read as an officer id.
  @Get('me/customers')
  @Roles('ADMIN', 'SUPER_ADMIN', 'MARKETER')
  @ApiOperation({ summary: 'Customers the signed-in admin or marketer onboarded (same filters as the customer list)' })
  @ApiOkPaginatedResponse(CustomerListItemDto)
  @ApiRoleForbiddenResponse()
  async getMyCustomerList(@CurrentUser() user: AuthUser, @Query() query: CustomersQueryDto) {
    const result = await this.service.getAccountOfficerCustomers(user.userId, query);
    return { ...result, message: 'Your customers' };
  }

  @Get('me/stats')
  @Roles('ADMIN', 'SUPER_ADMIN', 'MARKETER')
  @ApiOperation({
    summary: "The signed-in admin's or marketer's customers and portfolio",
    description: 'As `/:id/stats`, for the customers you onboarded.',
  })
  @ApiOkBaseResponse(AccountOfficerStatsDto)
  @ApiRoleForbiddenResponse()
  async myStats(@CurrentUser() user: AuthUser) {
    const data = await this.service.getAccountOfficerStats(user.userId);
    return { data, message: 'Statistics of your customers' };
  }

  @Get('me')
  @Roles('ADMIN', 'SUPER_ADMIN', 'MARKETER')
  @ApiOperation({ summary: 'Customers the signed-in admin onboarded (same filters as the customer list)' })
  @ApiOkPaginatedResponse(CustomerListItemDto)
  @ApiRoleForbiddenResponse()
  async getMyCustomers(@CurrentUser() user: AuthUser, @Query() query: CustomersQueryDto) {
    const result = await this.service.getAccountOfficerCustomers(user.userId, query);
    return { ...result, message: 'Customers assigned to the current logged-in admin has been queried successfully' };
  }

  @Get(':id/customers')
  @ApiOperation({ summary: "An account officer's customers (same filters as the customer list)" })
  @ApiParam({ name: 'id', description: 'Admin id, or `microbuilt-system-id` for self sign-ups', example: 'AD-1M8KI' })
  @ApiOkPaginatedResponse(CustomerListItemDto)
  @ApiRoleForbiddenResponse()
  async getCustomersByAccountOfficerId(@Param('id') id: string, @Query() query: CustomersQueryDto) {
    const result = await this.service.getAccountOfficerCustomers(id, query);
    return {
      ...result,
      message: 'Customers attached to the specified account officer has been queried successfully',
    };
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: "An account officer's customers and portfolio",
    description: 'Customer counts by account status and average repayment rate; ledger figures of their loans that were disbursed.',
  })
  @ApiParam({ name: 'id', description: 'Admin id, or `microbuilt-system-id` for self sign-ups', example: 'AD-1M8KI' })
  @ApiOkBaseResponse(AccountOfficerStatsDto)
  @ApiRoleForbiddenResponse()
  async stats(@Param('id') id: string) {
    const data = await this.service.getAccountOfficerStats(id);
    return { data, message: 'Statistics of this account officer sign ups' };
  }
}
