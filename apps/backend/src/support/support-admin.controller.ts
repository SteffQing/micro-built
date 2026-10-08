import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiRoleForbiddenResponse } from 'src/admin/common/decorators';
import { Access, CurrentUser } from 'src/auth/decorators';
import {
  ApiDtoErrorResponse,
  ApiGenericErrorResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import type { AuthUser } from 'src/common/types';
import { SupportAdminService } from './support-admin.service';
import { SupportEnabledGuard } from './support-enabled.guard';
import { SupportHandoffService } from './support-handoff.service';
import {
  StaffReplyDto,
  StaffSupportQueryDto,
  StaffSupportRowDto,
  StaffSupportThreadDto,
  SupportAnalyticsQueryDto,
  SupportConversationDto,
  SupportMessageDto,
} from './support.dto';

const NOT_FOUND = { desc: 'No such conversation', code: 404, err: 'Not Found', msg: 'Conversation not found' };
const NOT_WITH_TEAM = {
  desc: 'Closed, or never passed to the team',
  code: 409,
  err: 'Conflict',
  msg: 'This conversation is closed',
};

// The staff inbox (CHAT_SUPPORT.md §2.2): admins and super admins answer what customers, marketers and visitors pass
// to the team.
@ApiTags('Support')
@Access('ADMIN', 'SUPER_ADMIN')
@ApiRoleForbiddenResponse()
@UseGuards(SupportEnabledGuard)
@Controller('admin/support')
export class SupportAdminController {
  constructor(
    private readonly inbox: SupportAdminService,
    private readonly handoff: SupportHandoffService,
  ) {}

  @Get('conversations')
  @ApiOperation({
    summary: 'The support inbox',
    description:
      'Without `status`: every conversation passed to the team. `assignee=me`: yours. `q` searches the title, the ' +
      "requester's name and a visitor's contact.",
  })
  @ApiOkPaginatedResponse(StaffSupportRowDto)
  async list(@Query() query: StaffSupportQueryDto, @CurrentUser() user: AuthUser) {
    const { data, meta } = await this.inbox.list(query, user.userId);
    return { data, meta, message: 'Support conversations' };
  }

  @Get('waiting')
  @ApiOperation({ summary: 'How many conversations wait to be claimed (the nav badge)' })
  @ApiOkResponse({ schema: { example: { data: { count: 2 }, message: 'Waiting conversations' } } })
  async waiting() {
    return { data: { count: await this.inbox.waitingCount() }, message: 'Waiting conversations' };
  }

  @Get('analytics')
  @Access('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Support analytics (SUPER_ADMIN)',
    description:
      'Lagos days `from`–`to` (at most 90): per day conversations, messages and handoffs; the handoff rate; ratings; ' +
      'replies per provider and model; canned replies; and 429s per provider (quota hits).',
  })
  @ApiOkResponse({ description: 'The analytics' })
  @ApiDtoErrorResponse('Choose at most 90 days')
  async analytics(@Query() query: SupportAnalyticsQueryDto) {
    return { data: await this.inbox.analytics(query.from, query.to), message: 'Support analytics' };
  }

  @Get('conversations/:id')
  @ApiOperation({
    summary: 'A conversation, its requester and what the assistant looked at',
    description: "Each AI message lists the tools it called (names only). Marks the requester's messages read.",
  })
  @ApiOkBaseResponse(StaffSupportThreadDto)
  @ApiGenericErrorResponse(NOT_FOUND)
  async thread(@Param('id') id: string) {
    return { data: await this.inbox.thread(id), message: 'Conversation' };
  }

  @Post('conversations/:id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Claim a conversation', description: 'Another responder can take it over (audited).' })
  @ApiOkBaseResponse(SupportConversationDto)
  @ApiGenericErrorResponse(NOT_FOUND)
  @ApiGenericErrorResponse(NOT_WITH_TEAM)
  async claim(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { data: await this.handoff.claim(user, id), message: 'Claimed' };
  }

  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reply in the thread',
    description:
      'While it is with the team (claiming it first when nobody has). The requester hears in-app and by email (a ' +
      'visitor by email or SMS).',
  })
  @ApiOkBaseResponse(SupportMessageDto)
  @ApiDtoErrorResponse('Write a reply')
  @ApiGenericErrorResponse(NOT_FOUND)
  @ApiGenericErrorResponse(NOT_WITH_TEAM)
  async reply(@Param('id') id: string, @Body() dto: StaffReplyDto, @CurrentUser() user: AuthUser) {
    return { data: await this.handoff.reply(user, id, dto.text), message: 'Reply sent' };
  }

  @Post('conversations/:id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Close a conversation',
    description:
      'The requester can start a new one. A summary goes by email to the requester and to whoever handled it, when they have an address.',
  })
  @ApiOkBaseResponse(SupportConversationDto)
  @ApiGenericErrorResponse(NOT_FOUND)
  async close(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { data: await this.handoff.close(user, id), message: 'Closed' };
  }
}
