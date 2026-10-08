import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { RedisService } from 'src/database/redis.service';
import { quotaKey } from './chain/chain.service';
import { PROVIDERS } from './chain/links';
import {
  SUPPORT_LIMITS,
  type StaffRequesterDto,
  type StaffSupportQueryDto,
  type StaffSupportRowDto,
  type StaffSupportThreadDto,
} from './support.dto';
import { PUBLIC_CONVERSATION, PUBLIC_MESSAGE, SupportService } from './support.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ANALYTICS_DAYS = 90;
/** Lagos is UTC+1 all year. */
const lagosDayStart = (day: string) => new Date(`${day}T00:00:00+01:00`);

const REQUESTER = {
  userId: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  user: { select: { name: true, type: true, admin: { select: { role: true } } } },
} satisfies Prisma.SupportConversationSelect;

type RequesterRow = Prisma.SupportConversationGetPayload<{ select: typeof REQUESTER }>;

function requesterOf(row: RequesterRow): StaffRequesterDto {
  if (row.userId && row.user) {
    const role = row.user.type === 'ADMIN' ? (row.user.admin?.role ?? 'ADMIN') : 'CUSTOMER';
    return {
      name: row.user.name,
      role,
      ...(role === 'CUSTOMER' && { link: `/customers/${row.userId}` }),
      ...(role === 'MARKETER' && { link: `/account-officers/${row.userId}` }),
    };
  }
  return {
    ...(row.contactName && { name: row.contactName }),
    contact: row.contactEmail ?? row.contactPhone ?? undefined,
  };
}

const CANNED_KINDS = { refusal: 'refusal', off_topic: 'offTopic', eligibility: 'eligibility', busy: 'busy' } as const;

// The staff inbox (CHAT_SUPPORT.md §2.2): conversations passed to the team, their threads with what the assistant
// looked at (tool names only), and the super admins' analytics.
@Injectable()
export class SupportAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly support: SupportService,
  ) {}

  async list(query: StaffSupportQueryDto, staffId: string) {
    const page = query.page ?? 1;
    const limit = SUPPORT_LIMITS.pageSize;
    const q = query.q?.trim();
    const where: Prisma.SupportConversationWhereInput = {
      // The inbox is what was passed to the team, unless AI-only conversations are asked for.
      ...(query.status ? { status: query.status } : { handedOffAt: { not: null } }),
      ...(query.assignee === 'me' && { assigneeId: staffId }),
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { user: { name: { contains: q, mode: 'insensitive' } } },
          { contactName: { contains: q, mode: 'insensitive' } },
          { contactEmail: { contains: q, mode: 'insensitive' } },
          { contactPhone: { contains: q } },
        ],
      }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.supportConversation.findMany({
        where,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          handedOffAt: true,
          lastMessageAt: true,
          staffUnread: true,
          assignee: { select: { id: true, name: true } },
          ...REQUESTER,
        },
      }),
      this.prisma.supportConversation.count({ where }),
    ]);
    const data: StaffSupportRowDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      requester: requesterOf(row),
      assignee: row.assignee,
      handedOffAt: row.handedOffAt,
      lastMessageAt: row.lastMessageAt,
      unread: row.staffUnread,
    }));
    return { data, meta: { total, page, limit } };
  }

  /** Conversations waiting for someone to claim them: the nav badge. */
  waitingCount(): Promise<number> {
    return this.prisma.supportConversation.count({ where: { status: 'HANDOFF' } });
  }

  /** The thread; opening it marks the requester's messages read for staff. */
  async thread(id: string): Promise<StaffSupportThreadDto> {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { id },
      select: {
        ...PUBLIC_CONVERSATION,
        ...REQUESTER,
        staffUnread: true,
        assignee: { select: { id: true, name: true } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const rows = await this.prisma.supportMessage.findMany({
      where: { conversationId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { ...PUBLIC_MESSAGE, toolNames: true },
    });
    if (conversation.staffUnread) {
      await this.prisma.supportConversation.update({ where: { id }, data: { staffUnread: false } });
    }
    const messages = await this.support.toMessages(rows);
    const { id: conversationId, title, status, audience, handedOffAt, closedAt, lastMessageAt, createdAt } = conversation;
    return {
      conversation: {
        id: conversationId,
        title,
        status,
        audience,
        handedOffAt,
        closedAt,
        lastMessageAt,
        createdAt,
        assignee: conversation.assignee,
        contactName: conversation.contactName,
        contactEmail: conversation.contactEmail,
        contactPhone: conversation.contactPhone,
      },
      requester: requesterOf(conversation),
      messages: messages.map((message, i) => ({ ...message, toolNames: rows[i].toolNames })),
    };
  }

  async analytics(from: string, to: string) {
    if (from > to) throw new BadRequestException('The start date must be on or before the end date');
    const start = lagosDayStart(from);
    const end = new Date(lagosDayStart(to).getTime() + DAY_MS);
    const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
    if (days > MAX_ANALYTICS_DAYS) throw new BadRequestException(`Choose at most ${MAX_ANALYTICS_DAYS} days`);
    const dayList = Array.from({ length: days }, (_, i) =>
      new Date(start.getTime() + i * DAY_MS + 60 * 60 * 1000).toISOString().slice(0, 10),
    );

    // Lagos day of a UTC timestamp column: + 1 hour, then the date.
    const [conversations, messages, handoffs] = await Promise.all([
      this.prisma.$queryRaw<{ day: string; count: bigint }[]>(Prisma.sql`
        SELECT to_char(c."createdAt" + interval '1 hour', 'YYYY-MM-DD') AS day, count(*) AS count
        FROM "SupportConversation" c
        WHERE c."createdAt" >= ${start} AND c."createdAt" < ${end}
          AND EXISTS (SELECT 1 FROM "SupportMessage" m WHERE m."conversationId" = c.id)
        GROUP BY 1`),
      this.prisma.$queryRaw<{ day: string; count: bigint }[]>(Prisma.sql`
        SELECT to_char("createdAt" + interval '1 hour', 'YYYY-MM-DD') AS day, count(*) AS count
        FROM "SupportMessage"
        WHERE "role" = 'USER' AND "createdAt" >= ${start} AND "createdAt" < ${end}
        GROUP BY 1`),
      this.prisma.$queryRaw<{ day: string; count: bigint }[]>(Prisma.sql`
        SELECT to_char("handedOffAt" + interval '1 hour', 'YYYY-MM-DD') AS day, count(*) AS count
        FROM "SupportConversation"
        WHERE "handedOffAt" >= ${start} AND "handedOffAt" < ${end}
        GROUP BY 1`),
    ]);
    const byDay = (rows: { day: string; count: bigint }[]) => new Map(rows.map((row) => [row.day, Number(row.count)]));
    const [c, m, h] = [byDay(conversations), byDay(messages), byDay(handoffs)];
    const perDay = dayList.map((day) => ({
      day,
      conversations: c.get(day) ?? 0,
      messages: m.get(day) ?? 0,
      handoffs: h.get(day) ?? 0,
    }));
    const totalConversations = perDay.reduce((sum, row) => sum + row.conversations, 0);
    const totalHandoffs = perDay.reduce((sum, row) => sum + row.handoffs, 0);

    const aiInRange = { role: 'AI' as const, createdAt: { gte: start, lt: end } };
    const [ratings, providers, cannedRows] = await Promise.all([
      this.prisma.supportMessage.groupBy({ by: ['rating'], where: { ...aiInRange, rating: { not: null } }, _count: { _all: true } }),
      this.prisma.supportMessage.groupBy({
        by: ['provider', 'model'],
        where: { ...aiInRange, provider: { not: 'canned' } },
        _count: { _all: true },
      }),
      this.prisma.supportMessage.groupBy({ by: ['model'], where: { ...aiInRange, provider: 'canned' }, _count: { _all: true } }),
    ]);
    const canned = { refusal: 0, offTopic: 0, eligibility: 0, busy: 0 };
    for (const row of cannedRows) {
      const key = CANNED_KINDS[row.model as keyof typeof CANNED_KINDS];
      if (key) canned[key] = row._count._all;
    }

    return {
      perDay,
      handoffRate: totalConversations ? Math.round((totalHandoffs / totalConversations) * 1000) / 1000 : 0,
      ratings: {
        up: ratings.find((row) => row.rating === 'UP')?._count._all ?? 0,
        down: ratings.find((row) => row.rating === 'DOWN')?._count._all ?? 0,
      },
      byProvider: providers
        .filter((row) => row.provider)
        .map((row) => ({ provider: row.provider as string, model: row.model ?? '', replies: row._count._all }))
        .sort((a, b) => b.replies - a.replies),
      canned,
      quotaHits: await this.quotaHits(dayList),
    };
  }

  private async quotaHits(days: string[]) {
    const keys = days.flatMap((day) => PROVIDERS.map((provider) => ({ provider, key: quotaKey(day, provider) })));
    let values: (string | null)[] = [];
    try {
      values = keys.length ? await this.redis.getClient().mget(keys.map((k) => k.key)) : [];
    } catch {
      values = [];
    }
    const totals = new Map<string, number>();
    keys.forEach(({ provider }, i) => totals.set(provider, (totals.get(provider) ?? 0) + Number(values[i] ?? 0)));
    return PROVIDERS.map((provider) => ({ provider, count: totals.get(provider) ?? 0 })).filter((row) => row.count > 0);
  }
}

