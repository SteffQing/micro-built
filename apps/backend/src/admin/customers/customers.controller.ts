import {
  applyDecorators,
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
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
  ApiNullOkResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import { BaseResponseDto } from 'src/common/dto/generic.dto';
import type { AuthUser } from 'src/common/types';
import { AuditService } from 'src/audit/audit.service';
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
  ) {}

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
      'An Excel sheet of customers who already have running loans. The layout is checked now; the rows are imported in the background and the uploader gets a summary (in-app and email).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary', description: 'Excel spreadsheet (.xlsx, .xls)' } },
      required: ['file'],
    },
  })
  @ApiNullOkResponse(
    'File validated and queued',
    'File validated. The customers are being imported; you will get a summary when it finishes.',
    true,
  )
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
  async uploadFile(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const queued = await this.queue.addExistingCustomers({ file, requestedById: user.userId });
    await this.audit.record({
      actorId: user.userId,
      action: 'CUSTOMERS_IMPORTED',
      entityType: 'FILE',
      entityId: file.originalname,
      note: 'Existing customers sheet queued for import',
    });
    return queued;
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
