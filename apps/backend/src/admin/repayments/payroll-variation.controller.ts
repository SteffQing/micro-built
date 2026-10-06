import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiAcceptedResponse, ApiExtraModels, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { Access, CurrentUser } from 'src/auth/decorators';
import { ApiDtoErrorResponse, ApiGenericErrorResponse, ApiOkBaseResponse } from 'src/common/decorators';
import { BaseResponseDto, PeriodQueryDto } from 'src/common/dto';
import type { AuthUser } from 'src/common/types';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { GenerateVariationDto, PayrollVariationPreviewDto, RevertVariationDto } from '../common/dto/payroll-variation.dto';
import { PeriodDto } from '../common/dto/repayment.dto';
import {
  SignedFileUrlDto,
  VariationDraftQueuedDto,
  VariationOpenPeriodDto,
  VariationPreviewDto,
  VariationRevertResultDto,
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

  @Get('open')
  @ApiOperation({
    summary: 'The month the next variation is for',
    description:
      'The earliest month holding OPEN deductions (the first not yet generated); with none open, the first month ' +
      'from now not yet generated. The dialog opens on it.',
  })
  @ApiOkBaseResponse(VariationOpenPeriodDto)
  @ApiRoleForbiddenResponse()
  async openPeriod() {
    return { data: await this.service.openVariationPeriod(), message: 'Open payroll month found' };
  }

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Email a draft of the variation file',
    description: "Builds the month's file in the background and emails it as a draft to you (the signed-in admin's own email).",
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
    desc: 'The signed-in admin has no email address',
    msg: 'Add an email address to your account to receive drafts',
  })
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    desc: 'The month was already submitted',
    msg: 'JUNE 2026 has already been submitted: download its file instead',
  })
  @ApiRoleForbiddenResponse()
  async generate(@Body() dto: GenerateVariationDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.generateVariationDraft(dto.period, user.email, user.userId);
    return { data, message: `The ${data.period} draft will be emailed to ${data.email} shortly` };
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @Access('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Generate (submit) the variation',
    description:
      "Stores the month's file, freezes its deductions at those amounts and opens next month's. Once per month, in month order. " +
      'Every super admin is notified in-app and emailed the file.',
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
    return { data, message: `The ${data.period} variation has been generated` };
  }

  @Post('revert')
  @HttpCode(HttpStatus.OK)
  @Access('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Revert a submitted variation',
    description:
      'For a month submitted by mistake: the month goes back to unsubmitted, its deductions back to OPEN (recomputed), ' +
      "next month's OPEN deductions that the submit opened are removed and the stored file is deleted. Only the latest " +
      'submitted month, before any payroll upload, payment or close. Needs a reason and the super admin’s current authenticator code ' +
      '(audit log: VARIATION_REVERTED); every super admin is notified in-app and by email. The preview tells the UI when it is possible: `period.revertBlockedBy` is null.',
  })
  @ApiOkBaseResponse(VariationRevertResultDto)
  @ApiDtoErrorResponse('Enter the 6-digit code from your authenticator app')
  @ApiGenericErrorResponse({
    code: 403,
    err: 'Forbidden',
    desc: 'Wrong or locked authenticator code (5 wrong codes lock it for 15 minutes)',
    msg: 'That code is not correct. Use the current one from your app',
  })
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    desc: 'Not submitted, closed, a later month is submitted, or payroll money has come in for it',
    msg: 'A payroll file has been uploaded for OCTOBER 2026',
  })
  @ApiRoleForbiddenResponse()
  async revert(@Body() dto: RevertVariationDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.revertVariation(dto.period, dto.code, dto.reason, user.userId);
    return { data, message: `The ${data.period} variation has been reverted` };
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
