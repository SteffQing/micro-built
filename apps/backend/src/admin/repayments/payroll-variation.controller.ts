import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiAcceptedResponse, ApiExtraModels, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { Access, CurrentUser } from 'src/auth/decorators';
import { ApiDtoErrorResponse, ApiGenericErrorResponse, ApiOkBaseResponse } from 'src/common/decorators';
import { BaseResponseDto, PeriodQueryDto } from 'src/common/dto';
import type { AuthUser } from 'src/common/types';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { GenerateVariationDto, PayrollVariationPreviewDto } from '../common/dto/payroll-variation.dto';
import { PeriodDto } from '../common/dto/repayment.dto';
import {
  SignedFileUrlDto,
  VariationDraftQueuedDto,
  VariationPreviewDto,
  VariationSubmitResultDto,
} from '../common/entities/repayment.entity';
import { RepaymentsService } from './repayments.service';

// The monthly variation file payroll receives (V2.MD §0.5 "Variation for P"): preview, draft by
// email, submit (once, in month order), and download what was submitted.
@ApiTags('Payroll variations')
@Access('ADMIN', 'SUPER_ADMIN')
@Controller('admin/payroll-variations')
export class PayrollVariationController {
  constructor(private readonly service: RepaymentsService) {}

  @Get()
  @ApiOperation({
    summary: "Preview a month's variation",
    description:
      'The loans whose deduction payroll must start, amend or stop for the month, with the counts and whether the ' +
      'month has been submitted or closed. `action` and `reason` filter the rows (counts cover every row).',
  })
  @ApiOkBaseResponse(VariationPreviewDto)
  @ApiDtoErrorResponse('period must be a month as YYYY-MM')
  @ApiRoleForbiddenResponse()
  async preview(@Query() query: PayrollVariationPreviewDto) {
    return {
      data: await this.service.variationPreview(query.period, { action: query.action, reason: query.reason }),
      message: 'Payroll changes calculated',
    };
  }

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Email a draft of the variation file',
    description: "Builds the month's file in the background and emails it as a draft (to `email`, or to you).",
  })
  @ApiExtraModels(BaseResponseDto, VariationDraftQueuedDto)
  @ApiAcceptedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        { properties: { data: { $ref: getSchemaPath(VariationDraftQueuedDto) } } },
      ],
    },
  })
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    desc: 'No email given and the signed-in admin has none',
    msg: 'Add an email address to send the draft to',
  })
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    desc: 'The month was already submitted',
    msg: 'JUNE 2026 has already been submitted: download its file instead',
  })
  @ApiRoleForbiddenResponse()
  async generate(@Body() dto: GenerateVariationDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.generateVariationDraft(dto.period, dto.email ?? user.email, user.userId);
    return { data, message: `The ${data.period} draft will be emailed to ${data.email} shortly` };
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @Access('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Submit the variation to payroll',
    description:
      "Stores the month's file, freezes its deductions at those amounts and opens next month's. Once per month, in month order.",
  })
  @ApiOkBaseResponse(VariationSubmitResultDto)
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    desc: 'Already submitted, or an earlier month is still unsubmitted',
    msg: 'Submit MAY 2026 first; variations go to payroll in month order',
  })
  @ApiRoleForbiddenResponse()
  async submit(@Body() dto: PeriodDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.submitVariation(dto.period, user.userId);
    return { data, message: `The ${data.period} variation has been submitted` };
  }

  @Get('file')
  @ApiOperation({
    summary: 'Download the submitted variation file',
    description: 'A signed link to the file sent to payroll, valid for 10 minutes.',
  })
  @ApiOkBaseResponse(SignedFileUrlDto)
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    desc: 'The month has not been submitted',
    msg: "The JUNE 2026 variation hasn't been submitted yet",
  })
  @ApiRoleForbiddenResponse()
  async file(@Query() query: PeriodQueryDto) {
    return { data: await this.service.variationFileUrl(query.period), message: 'Download link created' };
  }
}
