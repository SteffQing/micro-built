import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Access, Confirm, CurrentUser } from 'src/auth/decorators';
import { ApiDtoErrorResponse, ApiGenericErrorResponse, ApiOkBaseResponse } from 'src/common/decorators';
import { BaseResponseDto } from 'src/common/dto';
import type { AuthUser } from 'src/common/types';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import {
  ReasonDto,
  VoucherBodyDto,
  VoucherReceiptDto,
  VoucherReportDto,
  VoucherRevertResultDto,
} from './vouchers.dto';
import { VouchersService } from './vouchers.service';

const SHEET_LIMIT_BYTES = 10 * 1024 * 1024;
const EXCEL_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];

/** The `file` field: an Excel sheet up to 10 MB (the content is checked again by its bytes). */
const SheetInterceptor = () =>
  FileInterceptor('file', {
    limits: { fileSize: SHEET_LIMIT_BYTES },
    fileFilter: (_req, file, callback) => {
      if (EXCEL_TYPES.includes(file.mimetype)) callback(null, true);
      else callback(new BadRequestException('Invalid file type. Only Excel files (.xlsx, .xls) are allowed'), false);
    },
  });

const SHEET_BODY = {
  schema: {
    type: 'object',
    required: ['file', 'organizationId'],
    properties: {
      file: { type: 'string', format: 'binary', description: "The organization's payroll return (.xlsx or .xls, up to 10 MB)" },
      organizationId: { type: 'string', description: 'The organization the voucher is for' },
      period: {
        type: 'string',
        example: '2026-06',
        description: "Optional YYYY-MM: the month the sheet must be for (it is read from the sheet's Period column)",
      },
    },
  },
};

const EARLIER_UNLOCKED_409 = {
  statusCode: 409,
  message: 'NPF has no voucher yet for MAY 2026: upload it, or mark it No payroll, before this one',
  error: 'Conflict',
  earlierUnlocked: [{ variationId: 'cmb2x0k1p0000abcd1234efgh', ym: '2026-05', label: 'MAY 2026' }],
};

// Vouchers go direct to the API (multipart, D8). An organization's payroll return for a month it has a variation
// for: the file's rows pay that variation's deductions, and the variation locks and settles (PLAN_V2 R4).
@ApiTags('Vouchers')
@Access('SUPER_ADMIN')
@Controller('admin/vouchers')
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Post()
  @Confirm('action')
  @ApiOperation({
    summary: "Upload an organization's voucher",
    description:
      "Upload the organization's payroll return for a month (multipart `file` and `organizationId`, sent direct to the API). " +
      "Its month is read from the Period column and every row must agree. The organization's variation for that month must have been " +
      'generated and not be locked, and the organization must have no earlier month still waiting for its voucher (the 409 lists ' +
      'them, in `earlierUnlocked`, so No payroll can be offered for them). The voucher locks the variation: its rows are paid ' +
      'against the variation\'s deductions in the background, then whatever payroll did not pay is settled (FAILED or PARTIAL, with ' +
      'penalties). The uploader gets a summary notification. Rows that could not be paid are left as inflows to resolve.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(SHEET_BODY)
  @ApiExtraModels(BaseResponseDto, VoucherReceiptDto)
  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        { properties: { data: { $ref: getSchemaPath(VoucherReceiptDto) } } },
      ],
    },
  })
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    desc: 'Not an Excel file, or the sheet has problems (missing columns, bad rows, rows for another month)',
    msg: 'Every row must be for the same month. These rows are not for JUNE 2026: 4, 9',
  })
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    desc: 'No such organization',
    msg: 'Organization not found',
  })
  @ApiResponse({
    status: 409,
    description:
      "No variation for the month, it is locked (a voucher or No payroll), the file was uploaded before, or an earlier month of the organization is unlocked (then the body lists it in `earlierUnlocked`)",
    schema: { example: EARLIER_UNLOCKED_409 },
  })
  @ApiRoleForbiddenResponse()
  @UseInterceptors(SheetInterceptor())
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: VoucherBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const data = await this.vouchers.upload(file, body.organizationId, user.userId, body.period);
    return {
      data,
      message: `The ${data.organization.name} ${data.period} voucher was uploaded: ${data.rows} rows are being processed. You will get a summary when it finishes.`,
    };
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check a voucher before uploading it',
    description:
      'Runs every check the upload runs and reports the problems (sheet-wide and per row) instead of refusing, with the ' +
      "organization's variation the voucher would land in, the rows that would be left as issues (`unmatched`, `otherOrganization`, " +
      '`notInVariation`) and the earlier months still waiting for a voucher. Nothing is stored or queued.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(SHEET_BODY)
  @ApiOkBaseResponse(VoucherReportDto)
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    desc: 'No file, or not an Excel file',
    msg: 'Upload the payroll as an Excel file (.xlsx or .xls)',
  })
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    desc: 'No such organization',
    msg: 'Organization not found',
  })
  @ApiRoleForbiddenResponse()
  @UseInterceptors(SheetInterceptor())
  async validate(@UploadedFile() file: Express.Multer.File | undefined, @Body() body: VoucherBodyDto) {
    if (!file) throw new BadRequestException('No file provided');
    const data = await this.vouchers.validate(file, body.organizationId, body.period);
    return {
      data,
      message: data.valid
        ? `The sheet is ready to upload for ${data.organization.name}, ${data.period}`
        : 'The sheet has problems: see the report for details',
    };
  }

  @Delete(':id')
  @Confirm('action')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revert a voucher',
    description:
      "Undoes a voucher uploaded by mistake or with rows missing: its payments are removed (a loan they paid off is running again), " +
      'the penalties and pending tenure proposals charged when it was settled go, and the variation waits for a voucher again (upload ' +
      "it again, or mark it No payroll). Only while the voucher's month is still the current month (Lagos) and the organization has no " +
      'variation for the next one. Refused after a payment applied to the loans since (an accepted liquidation) or a decided tenure ' +
      'proposal. Needs a reason; the audit log records VOUCHER_REVERTED.',
  })
  @ApiOkBaseResponse(VoucherRevertResultDto)
  @ApiDtoErrorResponse('Say why, in a few words')
  @ApiGenericErrorResponse({ code: 404, err: 'Not Found', desc: 'No such voucher', msg: 'Voucher not found' })
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    desc: "Its month is over, the next month has a variation, it is still being processed, or money has moved since",
    msg: "Only a voucher for the current month (JUNE 2026) can be reverted, and this one is for MAY 2026",
  })
  @ApiRoleForbiddenResponse()
  async revert(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthUser) {
    const data = await this.vouchers.revert(id, dto.reason, user.userId);
    return {
      data,
      message: `The voucher was reverted: ${data.inflowsRemoved} payments removed and the variation is open for a voucher again`,
    };
  }
}
