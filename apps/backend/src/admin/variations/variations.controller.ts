import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiAcceptedResponse, ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { Access, Confirm, CurrentUser } from 'src/auth/decorators';
import { ApiDtoErrorResponse, ApiGenericErrorResponse, ApiOkBaseResponse } from 'src/common/decorators';
import { BaseResponseDto } from 'src/common/dto';
import type { AuthUser } from 'src/common/types';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import {
  GenerateVariationsDto,
  VariationDraftDto,
  VariationFileQueryDto,
  VariationHistoryQueryDto,
  VariationsQueryDto,
} from './variations.dto';
import {
  GenerateVariationsResultDto,
  OrganizationVariationDto,
  VariationDraftResultDto,
  VariationFileUrlDto,
  VariationHistoryItemDto,
} from './variations.entity';
import { VariationsAdminService } from './variations.service';

const ORGANIZATION_NOT_FOUND = {
  code: 404,
  err: 'Not Found',
  desc: 'No organization with this id',
  msg: 'Organization not found',
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

// The monthly variation file each organization's payroll receives (PLAN_V2 §2): preview, generate (as often as
// needed until the voucher lands), a draft by email, the stored files and the history. The voucher, No payroll and
// revert live with the repayments.
@ApiTags('Admin:Variations')
@Access('ADMIN', 'SUPER_ADMIN')
@ApiRoleForbiddenResponse()
@Controller('admin/variations')
export class VariationsController {
  constructor(private readonly service: VariationsAdminService) {}

  @Get()
  @ApiOperation({
    summary: "Preview an organization's variation for a month",
    description:
      'The loans whose deduction payroll must start, amend or stop, as generating would freeze them now, with the ' +
      'variation’s state (version, lock, whether to regenerate) and why generating is refused, if it is. `action` ' +
      'and `reason` filter the rows (counts cover every row). Once the variation is locked, the rows are what its ' +
      'current version holds.',
  })
  @ApiOkBaseResponse(OrganizationVariationDto)
  @ApiDtoErrorResponse('period must be a month as YYYY-MM')
  @ApiGenericErrorResponse(ORGANIZATION_NOT_FOUND)
  async preview(@Query() query: VariationsQueryDto) {
    return { data: await this.service.preview(query), message: 'Payroll changes calculated' };
  }

  @Get('history')
  @ApiOperation({
    summary: "An organization's variations, newest month first",
    description: 'Each generated month with its current version, when it was last generated and what locked it, if anything.',
  })
  @ApiExtraModels(BaseResponseDto, VariationHistoryItemDto)
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        { properties: { data: { type: 'array', items: { $ref: getSchemaPath(VariationHistoryItemDto) } } } },
      ],
    },
  })
  @ApiGenericErrorResponse(ORGANIZATION_NOT_FOUND)
  async history(@Query() query: VariationHistoryQueryDto) {
    return { data: await this.service.history(query), message: 'Variation history fetched successfully' };
  }

  @Post('generate')
  @Confirm('action')
  @HttpCode(HttpStatus.ACCEPTED)
  @Access('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Generate variations for a month',
    description:
      'For each organization named (or every one with `all`): no deductions in the month → skipped; refused when its ' +
      'variation is locked, a later month already exists or an earlier month was never generated (the reason comes ' +
      'back); otherwise queued, one job each. Generating freezes the organization’s deductions for the month and ' +
      'writes the file as the next version; it can be repeated until the voucher (or No payroll) locks it. The ' +
      'requester is told in-app when each job finishes or fails.',
  })
  @ApiExtraModels(BaseResponseDto, GenerateVariationsResultDto)
  @ApiAcceptedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        { properties: { data: { $ref: getSchemaPath(GenerateVariationsResultDto) } } },
      ],
    },
  })
  @ApiDtoErrorResponse('Choose the organizations to generate for, or all of them')
  @ApiGenericErrorResponse(ORGANIZATION_NOT_FOUND)
  async generate(@Body() dto: GenerateVariationsDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.generate(dto, user.userId);
    const { queued, skipped, refused } = data;
    const parts = [
      queued.length ? `${plural(queued.length, 'variation')} queued for ${data.period.label}` : null,
      skipped.length ? `${skipped.length} skipped (no deductions)` : null,
      refused.length ? `${refused.length} refused` : null,
    ].filter(Boolean);
    return { data, message: parts.length ? parts.join(', ') : `No organization to generate for in ${data.period.label}` };
  }

  @Post('draft')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Email a draft of the variation file',
    description:
      'Builds the file generating would produce now, in the background, and emails it to you (the signed-in admin’s ' +
      'own address). Nothing is frozen.',
  })
  @ApiExtraModels(BaseResponseDto, VariationDraftResultDto)
  @ApiAcceptedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        { properties: { data: { $ref: getSchemaPath(VariationDraftResultDto) } } },
      ],
    },
  })
  @ApiGenericErrorResponse({
    code: 400,
    err: 'Bad Request',
    desc: 'The signed-in admin has no email address',
    msg: 'Add an email address to your account to receive drafts',
  })
  @ApiGenericErrorResponse(ORGANIZATION_NOT_FOUND)
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    desc: 'Generating is refused for this month (locked, a later month exists, an earlier month was never generated) or there are no deductions',
    msg: 'NPF has no deductions for OCTOBER 2026: there is nothing to draft',
  })
  async draft(@Body() dto: VariationDraftDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.draft(dto, user.email, user.userId);
    return { data, message: `The ${data.period} draft for ${data.organization} will be emailed to ${data.email} shortly` };
  }

  @Get(':id/file')
  @ApiOperation({
    summary: 'Download a stored variation file',
    description:
      'A signed link, valid for 10 minutes, to the current version of the file, or to `version` while it is still ' +
      'kept (every version until the variation locks, then only the current one).',
  })
  @ApiOkBaseResponse(VariationFileUrlDto)
  @ApiGenericErrorResponse({
    code: 404,
    err: 'Not Found',
    desc: 'No such variation, or that version is no longer stored',
    msg: "Version 1 of this variation isn't stored",
  })
  async file(@Param('id') id: string, @Query() query: VariationFileQueryDto) {
    return { data: await this.service.fileUrl(id, query), message: 'Download link created' };
  }
}
