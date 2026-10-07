import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, SupportRating } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { canHandoff, ownerOf, type SupportCaller } from './caller';
import { SupportLimits } from './limits';
import { suggestionsFor } from './suggestions';
import {
  SUPPORT_LIMITS,
  type SupportConversationDto,
  type SupportConversationRowDto,
  type SupportMessageDto,
  type SupportRatingResultDto,
  type SupportSessionDto,
  type SupportThreadDto,
} from './support.dto';
import { turnstileRequired, verifyTurnstile } from './turnstile';

/** A conversation as its requester sees it. */
export const PUBLIC_CONVERSATION = {
  id: true,
  title: true,
  status: true,
  audience: true,
  handedOffAt: true,
  closedAt: true,
  lastMessageAt: true,
  createdAt: true,
} satisfies Prisma.SupportConversationSelect;

/** A message as its requester sees it: never the provider, model, tools or guard verdicts. */
export const PUBLIC_MESSAGE = {
  id: true,
  role: true,
  body: true,
  authorId: true,
  rating: true,
  offerHandoff: true,
  createdAt: true,
} satisfies Prisma.SupportMessageSelect;

type PublicMessageRow = Prisma.SupportMessageGetPayload<{ select: typeof PUBLIC_MESSAGE }>;

export const NEW_CONVERSATION_TITLE = 'New conversation';

export const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || undefined;

export const titleFrom = (text: string) => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length <= SUPPORT_LIMITS.titleChars ? line : `${line.slice(0, SUPPORT_LIMITS.titleChars - 1).trimEnd()}…`;
};

export const supportEnabled = () => process.env.SUPPORT_ENABLED === 'true';

// Conversations from the requester's side (CHAT_SUPPORT.md §2.1). Every read and write is scoped to the caller: a
// conversation that isn't theirs is answered as not found.
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: SupportLimits,
  ) {}

  async session(caller: SupportCaller): Promise<SupportSessionDto> {
    const name = caller.user
      ? (await this.prisma.user.findUnique({ where: { id: caller.user.userId }, select: { name: true } }))?.name
      : undefined;
    const remainingToday = supportEnabled() ? await this.limits.remainingToday(caller) : undefined;
    return {
      enabled: supportEnabled(),
      audience: caller.audience,
      restricted: caller.restricted,
      ...(caller.user && { firstName: firstName(name) }),
      suggestions: suggestionsFor(caller.audience, caller.restricted),
      limits: { messageChars: SUPPORT_LIMITS.messageChars, ...(remainingToday !== undefined && { remainingToday }) },
      turnstileRequired: !caller.user && turnstileRequired(),
      canHandoff: canHandoff(caller),
    };
  }

  async create(caller: SupportCaller, turnstileToken?: string): Promise<SupportConversationDto> {
    if (!caller.user) {
      await verifyTurnstile(turnstileToken, caller.ip);
      await this.limits.takeConversation(caller);
    }
    return this.prisma.supportConversation.create({
      data: { ...ownerOf(caller), audience: caller.audience, title: NEW_CONVERSATION_TITLE },
      select: PUBLIC_CONVERSATION,
    });
  }

  async list(caller: SupportCaller, page = 1) {
    const where: Prisma.SupportConversationWhereInput = {
      ...ownerOf(caller),
      // An empty conversation (opened, never written in) isn't history.
      messages: { some: {} },
    };
    const limit = SUPPORT_LIMITS.pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.supportConversation.findMany({
        where,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, title: true, status: true, lastMessageAt: true, requesterUnread: true },
      }),
      this.prisma.supportConversation.count({ where }),
    ]);
    const data: SupportConversationRowDto[] = rows.map(({ requesterUnread, ...row }) => ({
      ...row,
      unread: requesterUnread,
    }));
    return { data, meta: { total, page, limit } };
  }

  /** The thread; opening it marks the team's replies read. */
  async thread(caller: SupportCaller, id: string): Promise<SupportThreadDto> {
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id, ...ownerOf(caller) },
      select: { ...PUBLIC_CONVERSATION, requesterUnread: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const rows = await this.prisma.supportMessage.findMany({
      where: { conversationId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: PUBLIC_MESSAGE,
    });
    const { requesterUnread, ...dto } = conversation;
    if (requesterUnread) {
      await this.prisma.supportConversation.update({ where: { id }, data: { requesterUnread: false } });
    }
    return { conversation: dto, messages: await this.toMessages(rows) };
  }

  /** Thumbs up or down on one of the assistant's replies in the caller's own conversation (C12). */
  async rate(caller: SupportCaller, messageId: string, rating: SupportRating): Promise<SupportRatingResultDto> {
    const { count } = await this.prisma.supportMessage.updateMany({
      where: { id: messageId, role: 'AI', conversation: ownerOf(caller) },
      data: { rating },
    });
    if (count === 0) throw new NotFoundException('Message not found');
    return { id: messageId, rating };
  }

  /** The caller's conversation, or 404. */
  async owned(caller: SupportCaller, id: string) {
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id, ...ownerOf(caller) },
      select: { ...PUBLIC_CONVERSATION, userId: true, visitorId: true, assigneeId: true, topic: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  /** Message rows → DTOs, with each staff author's first name. */
  async toMessages(rows: PublicMessageRow[]): Promise<SupportMessageDto[]> {
    const authorIds = [...new Set(rows.map((row) => row.authorId).filter((id): id is string => Boolean(id)))];
    const authors = authorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } })
      : [];
    const names = new Map(authors.map((author) => [author.id, firstName(author.name)]));
    return rows.map(({ authorId, ...row }) => ({
      ...row,
      ...(authorId && names.get(authorId) && { authorName: names.get(authorId) }),
    }));
  }
}
