import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { AuditService } from 'src/audit/audit.service';
import { Access, CurrentUser } from 'src/auth/decorators';
import { ApiRoleForbiddenResponse } from 'src/admin/common/decorators';
import type { AuthUser } from 'src/common/types';
import { ApiDtoErrorResponse, ApiGenericErrorResponse, ApiOkBaseResponse } from 'src/common/decorators';
import {
  CalloutDto,
  CreateCalloutDto,
  UpdateCalloutDto,
  ViewerCalloutDto,
  ViewerCalloutsQueryDto,
} from './callouts.dto';
import { CALLOUTS_PER_VIEWER, CalloutsService, describeChange } from './callouts.service';

const listOf = (model: typeof ViewerCalloutDto | typeof CalloutDto, message: string) =>
  ApiOkResponse({
    schema: {
      properties: {
        data: { type: 'array', items: { $ref: getSchemaPath(model) } },
        message: { type: 'string', example: message },
      },
    },
  });

@ApiTags('Callouts')
@Access('CUSTOMER', 'MARKETER', 'ADMIN', 'SUPER_ADMIN')
@Controller('callouts')
export class CalloutsController {
  constructor(private readonly callouts: CalloutsService) {}

  @Get()
  @ApiOperation({
    summary: "The signed-in user's callouts for the sidebar",
    description:
      `At most ${CALLOUTS_PER_VIEWER} published callouts for the user's role, none past its date: the pinned one first, then by ` +
      'priority and the most recently published. `exclude` leaves out the ones dismissed in this browser (never the ' +
      'pinned one).',
  })
  @ApiExtraModels(ViewerCalloutDto)
  @listOf(ViewerCalloutDto, 'Callouts returned')
  async mine(@CurrentUser() user: AuthUser, @Query() query: ViewerCalloutsQueryDto) {
    const exclude = (query.exclude ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 60);
    return { data: await this.callouts.forViewer(user.role, exclude), message: 'Callouts returned' };
  }
}

@ApiTags('Callouts')
@Access('SUPER_ADMIN')
@ApiRoleForbiddenResponse()
@Controller('admin/callouts')
export class CalloutsAdminController {
  constructor(
    private readonly callouts: CalloutsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Every callout, published or draft (SUPER_ADMIN)' })
  @ApiExtraModels(CalloutDto)
  @listOf(CalloutDto, 'Callouts returned')
  async list() {
    return { data: await this.callouts.list(), message: 'Callouts returned' };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create a callout (SUPER_ADMIN)',
    description: 'A draft unless `status` is PUBLISHED. Pinning it unpins any other; only a published one can be pinned.',
  })
  @ApiOkBaseResponse(CalloutDto)
  @ApiDtoErrorResponse(['Give it a title', 'Only a published callout can be pinned', 'Choose who sees it before publishing'])
  async create(@Body() dto: CreateCalloutDto, @CurrentUser() user: AuthUser) {
    const callout = await this.callouts.create(dto, user.userId);
    await this.audit.record({
      actorId: user.userId,
      action: 'CALLOUT_CREATED',
      entityType: 'CALLOUT',
      entityId: callout.id,
      note: `${callout.title} (${callout.status === 'PUBLISHED' ? 'published' : 'draft'}${callout.pinned ? ', pinned' : ''})`,
    });
    return {
      data: callout,
      message: callout.status === 'PUBLISHED' ? `"${callout.title}" is live` : `"${callout.title}" saved as a draft`,
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit, publish, unpublish, pin or unpin a callout (SUPER_ADMIN)',
    description:
      'Any fields of the create body, and `renew` to start its 7 days again. Unpublishing unpins it; pinning it unpins ' +
      'any other, which gets a fresh 7 days.',
  })
  @ApiOkBaseResponse(CalloutDto)
  @ApiDtoErrorResponse(['Only a published callout can be pinned', 'Choose who sees it before publishing'])
  @ApiGenericErrorResponse({ desc: 'No such callout', code: 404, err: 'Not Found', msg: 'Callout not found' })
  @ApiGenericErrorResponse({
    desc: 'Another callout was pinned at the same moment',
    code: 409,
    err: 'Conflict',
    msg: 'Another callout was pinned just now. Try again.',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateCalloutDto, @CurrentUser() user: AuthUser) {
    const { before, after } = await this.callouts.update(id, dto);
    const changes = describeChange(before, after);
    if (changes.length) {
      await this.audit.record({
        actorId: user.userId,
        action: 'CALLOUT_UPDATED',
        entityType: 'CALLOUT',
        entityId: id,
        note: `${after.title}: ${changes.join(', ')}`,
      });
    }
    return { data: after, message: changes.length ? `"${after.title}" ${changes.join(', ')}` : 'Nothing changed' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a callout (SUPER_ADMIN)', description: 'Not a pinned one: unpin it first.' })
  @ApiOkBaseResponse(CalloutDto)
  @ApiGenericErrorResponse({ desc: 'No such callout', code: 404, err: 'Not Found', msg: 'Callout not found' })
  @ApiGenericErrorResponse({
    desc: 'It is pinned',
    code: 409,
    err: 'Conflict',
    msg: 'A pinned callout stays until you unpin it',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const callout = await this.callouts.remove(id);
    await this.audit.record({
      actorId: user.userId,
      action: 'CALLOUT_DELETED',
      entityType: 'CALLOUT',
      entityId: id,
      note: callout.title,
    });
    return { data: callout, message: `"${callout.title}" deleted` };
  }
}
