import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  MessageEvent,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  Sse,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { AllowAnonymous } from 'src/auth/decorators';
import {
  ApiDtoErrorResponse,
  ApiGenericErrorResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import type { AuthUser } from 'src/common/types';
import { PrismaService } from 'src/database/prisma.service';
import { RESPONDER_AUDIENCES, ownerOf, resolveCaller } from './caller';
import { SupportChatService } from './support-chat.service';
import { SupportAlwaysOn, SupportEnabledGuard } from './support-enabled.guard';
import { SupportEventsService } from './support-events.service';
import { SupportHandoffService } from './support-handoff.service';
import {
  CreateSupportConversationDto,
  SendSupportMessageDto,
  SupportConversationDto,
  SupportConversationRowDto,
  SupportHandoffDto,
  SupportMessageDto,
  SupportPageQueryDto,
  SupportRatingDto,
  SupportRatingResultDto,
  SupportSessionDto,
  SupportThreadDto,
} from './support.dto';
import { SupportService } from './support.service';

type SupportRequest = Request & { user?: AuthUser };

const LIMIT_RESPONSE = {
  desc: 'Over a message or conversation limit (C7)',
  code: 429,
  err: 'Too Many Requests',
  msg: "You've sent today's 40 messages to the assistant. Try again tomorrow, or email the team.",
};
const NOT_FOUND = { desc: 'Not the caller’s conversation, or none', code: 404, err: 'Not Found', msg: 'Conversation not found' };
const SWITCHED_OFF = {
  desc: 'SUPPORT_ENABLED is off: fall back to email (C14)',
  code: 503,
  err: 'Service Unavailable',
  msg: 'Chat support is switched off. Email the team instead.',
};

/** The live stream is the requester's, or a responder's. */
@Injectable()
export class SupportStreamGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SupportRequest>();
    const caller = resolveCaller(request);
    const id = String(request.params.id);
    const responder = caller.user && !caller.restricted && RESPONDER_AUDIENCES.includes(caller.audience);
    const found = await this.prisma.supportConversation.findFirst({
      where: { id, ...(!responder && ownerOf(caller)) },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Conversation not found');
    return true;
  }
}

// The support chat (CHAT_SUPPORT.md §2.1). Open to everyone: the caller is the session's user or, signed out, the
// visitor cookie (caller.ts). Every call goes direct to the API, never through the frontend's rewrite, so the stream
// isn't buffered and the cookie comes back to the host that set it.
@ApiTags('Support')
@AllowAnonymous()
@UseGuards(SupportEnabledGuard)
@ApiGenericErrorResponse(SWITCHED_OFF)
@Controller('support')
export class SupportController {
  constructor(
    private readonly support: SupportService,
    private readonly chat: SupportChatService,
    private readonly handoff: SupportHandoffService,
    private readonly events: SupportEventsService,
  ) {}

  @Get('session')
  @SupportAlwaysOn()
  @ApiOperation({
    summary: 'Who the chat is talking to, and what it offers them',
    description:
      'Answers even when support is switched off (`enabled: false`: fall back to email). Signed out, it sets the ' +
      '`mb_support_visitor` cookie (httpOnly, 30 days) that the visitor’s conversations belong to.',
  })
  @ApiOkBaseResponse(SupportSessionDto)
  async session(@Req() request: SupportRequest, @Res({ passthrough: true }) response: Response) {
    const data = await this.support.session(resolveCaller(request, response));
    return { data, message: 'Support session' };
  }

  @Post('conversations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start a conversation',
    description: 'Visitors send a Turnstile token (when the session says `turnstileRequired`) and may start 3 a day.',
  })
  @ApiOkBaseResponse(SupportConversationDto)
  @ApiDtoErrorResponse('Confirm you are human to start a conversation')
  @ApiGenericErrorResponse(LIMIT_RESPONSE)
  async create(
    @Req() request: SupportRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: CreateSupportConversationDto,
  ) {
    const data = await this.support.create(resolveCaller(request, response), dto.turnstileToken);
    return { data, message: 'Conversation started' };
  }

  @Get('conversations')
  @ApiOperation({ summary: "The caller's conversations, newest first" })
  @ApiOkPaginatedResponse(SupportConversationRowDto)
  async list(@Req() request: SupportRequest, @Query() query: SupportPageQueryDto) {
    const { data, meta } = await this.support.list(resolveCaller(request), query.page);
    return { data, meta, message: 'Conversations' };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'A conversation and its messages', description: "Marks the team's replies read." })
  @ApiOkBaseResponse(SupportThreadDto)
  @ApiGenericErrorResponse(NOT_FOUND)
  async thread(@Req() request: SupportRequest, @Param('id') id: string) {
    return { data: await this.support.thread(resolveCaller(request), id), message: 'Conversation' };
  }

  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a message',
    description:
      'Send only the new message: the server holds the history. While the conversation is with the assistant the ' +
      "answer is the AI SDK's UI message stream (text, tool parts showing only the tool's name, then a `data-support` " +
      'part `{ messageId, offerHandoff }`). While it is with the team the answer is JSON `{ data: SupportMessageDto }` ' +
      'and the assistant stays silent.',
  })
  @ApiProduces('text/event-stream', 'application/json')
  @ApiOkResponse({ description: 'The reply stream, or the stored message when the conversation is with the team' })
  @ApiExtraModels(SupportMessageDto)
  @ApiDtoErrorResponse('Keep a message under 1,000 characters')
  @ApiGenericErrorResponse(NOT_FOUND)
  @ApiGenericErrorResponse({
    desc: 'The conversation is closed',
    code: 409,
    err: 'Conflict',
    msg: 'This conversation is closed. Start a new one to keep going.',
  })
  @ApiGenericErrorResponse(LIMIT_RESPONSE)
  async send(
    @Req() request: SupportRequest,
    @Res() response: Response,
    @Param('id') id: string,
    @Body() dto: SendSupportMessageDto,
  ) {
    await this.chat.send(resolveCaller(request), id, dto, response);
  }

  @Post('conversations/:id/handoff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pass the conversation to the team',
    description:
      'Customers, marketers and visitors (who leave an email or phone number). Idempotent. Admins are the ' +
      'responders: 403.',
  })
  @ApiOkBaseResponse(SupportConversationDto)
  @ApiDtoErrorResponse('Leave an email address or phone number so the team can reply')
  @ApiGenericErrorResponse(NOT_FOUND)
  async handoffConversation(@Req() request: SupportRequest, @Param('id') id: string, @Body() dto: SupportHandoffDto) {
    const data = await this.handoff.handoff(resolveCaller(request), id, dto);
    return { data, message: 'Passed to the team' };
  }

  @Post('messages/:id/rating')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Thumbs up or down on one of the assistant's replies in the caller's conversation" })
  @ApiOkBaseResponse(SupportRatingResultDto)
  @ApiGenericErrorResponse({ desc: 'Not an assistant reply of the caller', code: 404, err: 'Not Found', msg: 'Message not found' })
  async rate(@Req() request: SupportRequest, @Param('id') id: string, @Body() dto: SupportRatingDto) {
    return { data: await this.support.rate(resolveCaller(request), id, dto.rating), message: 'Thanks for the feedback' };
  }

  @Sse('conversations/:id/events')
  @UseGuards(SupportStreamGuard)
  @ApiOperation({
    summary: 'Live events of a conversation (SSE)',
    description:
      'For the requester and for admins. `message` (`{ messageId }`): a new message; `status` (`{ status }`): ' +
      'claimed, closed or handed off; `ping` every 25 s. Refetch the conversation on an event.',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: 'The event stream', content: { 'text/event-stream': {} } })
  @ApiGenericErrorResponse(NOT_FOUND)
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return this.events.stream(id);
  }
}
