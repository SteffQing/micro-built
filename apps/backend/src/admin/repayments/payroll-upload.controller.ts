import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { Access, Confirm, CurrentUser } from 'src/auth/decorators';
import { ApiGenericErrorResponse, ApiOkBaseResponse } from 'src/common/decorators';
import { BaseResponseDto } from 'src/common/dto';
import { YM_PATTERN } from 'src/common/dto/period.dto';
import type { AuthUser } from 'src/common/types';
import type {
  PayrollRowIssue,
  PayrollSheetReport,
  PayrollUploadReceipt,
} from 'src/common/types/repayment.interface';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { PayrollUploadService } from './payroll-upload.service';

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
    required: ['file'],
    properties: {
      file: { type: 'string', format: 'binary', description: 'The payroll return (.xlsx or .xls, up to 10 MB)' },
      period: {
        type: 'string',
        example: '2026-06',
        description: "Optional YYYY-MM: the month the sheet must be for (it is read from the sheet's Period column)",
      },
    },
  },
};

export class PayrollSheetBodyDto {
  @ApiPropertyOptional({ example: '2026-06', description: 'The month the sheet must be for (YYYY-MM)' })
  @IsOptional()
  @Matches(YM_PATTERN, { message: 'period must be a month as YYYY-MM' })
  period?: string;
}

export class PayrollUploadReceiptDto implements PayrollUploadReceipt {
  @ApiProperty({ example: 'cmb2x0k1p0000abcd1234efgh' })
  uploadId: string;

  @ApiProperty({ example: 'JUNE 2026' })
  period: string;

  @ApiProperty({ example: 152, description: 'Data rows queued for processing' })
  rows: number;
}

export class PayrollRowIssueDto implements PayrollRowIssue {
  @ApiProperty({ example: 7, description: "The sheet's row number (the header is row 1)" })
  row: number;

  @ApiProperty({ example: '123456' })
  staffId: string;

  @ApiProperty({ example: ['amount must be a number of naira, 0 or more', 'duplicate staffid'] })
  issues: string[];
}

export class PayrollSheetReportDto implements PayrollSheetReport {
  @ApiProperty({ example: false, description: 'True when the sheet can be uploaded as it is' })
  valid: boolean;

  @ApiProperty({ example: 'JUNE 2026', nullable: true, type: String })
  period: string | null;

  @ApiProperty({ example: 152 })
  rows: number;

  @ApiProperty({ example: [], description: 'Required columns the header row lacks' })
  missingColumns: string[];

  @ApiProperty({
    example: ['Submit the JUNE 2026 variation before uploading its payroll'],
    description: 'Plain sentences, most important first; the upload would be refused with the first one',
  })
  problems: string[];

  @ApiProperty({ type: [PayrollRowIssueDto] })
  invalidRows: PayrollRowIssueDto[];
}

// Payroll returns go direct to the API (multipart, D8). Only the upload and validate routes live
// here; the rest of /admin/repayments is RepaymentsController. Registered before it, so these
// literal paths are matched before its `:id` routes.
@ApiTags('Admin Repayments')
@Access('SUPER_ADMIN')
@Controller('admin/repayments')
export class PayrollUploadController {
  constructor(private readonly uploads: PayrollUploadService) {}

  @Post('upload')
  @Confirm('action')
  @ApiOperation({
    summary: 'Upload a payroll return',
    description:
      "Upload the government payroll sheet (multipart `file`, sent direct to the API). Its month is read from the Period column and every row must agree; the month's variation must have been submitted and the month must not be closed. The rows are processed in the background and the uploader gets a summary notification.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(SHEET_BODY)
  @ApiExtraModels(BaseResponseDto, PayrollUploadReceiptDto)
  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        { properties: { data: { $ref: getSchemaPath(PayrollUploadReceiptDto) } } },
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
    code: 409,
    err: 'Conflict',
    desc: "The month's variation isn't submitted, the month is closed, or the file was uploaded before",
    msg: 'Submit the JUNE 2026 variation before uploading its payroll',
  })
  @ApiRoleForbiddenResponse()
  @UseInterceptors(SheetInterceptor())
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: PayrollSheetBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const data = await this.uploads.upload(file, user.userId, body.period);
    return {
      data,
      message: `The ${data.period} payroll was uploaded: ${data.rows} rows are being processed. You will get a summary when it finishes.`,
    };
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check a payroll return before uploading it',
    description:
      'Runs every check the upload runs and reports the problems (sheet-wide and per row) instead of refusing. Nothing is stored or queued.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(SHEET_BODY)
  @ApiOkBaseResponse(PayrollSheetReportDto)
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    desc: 'No file, or not an Excel file',
    msg: 'Upload the payroll as an Excel file (.xlsx or .xls)',
  })
  @ApiRoleForbiddenResponse()
  @UseInterceptors(SheetInterceptor())
  async validate(@UploadedFile() file: Express.Multer.File | undefined, @Body() body: PayrollSheetBodyDto) {
    if (!file) throw new BadRequestException('No file provided');
    const data = await this.uploads.validate(file, body.period);
    return {
      data,
      message: data.valid
        ? `The sheet is ready to upload for ${data.period}`
        : 'The sheet has problems: see the report for details',
    };
  }
}
