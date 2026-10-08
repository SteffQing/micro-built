import { Injectable, Logger, MessageEvent, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { filter, interval, map, merge, Observable, Subject, takeUntil } from 'rxjs';
import { PrismaService } from 'src/database/prisma.service';
import { RedisService } from 'src/database/redis.service';
import { SYSTEM_ACTOR_ID } from 'src/ledger/ledger.constants';
import { NotificationStreamService } from 'src/notifications/notification-stream.service';

/** Redis channels carrying one conversation's events: `support:<conversationId>`. */
const CHANNEL_PREFIX = 'support:';
const HEARTBEAT_MS = 25_000;

export type SupportEventType = 'message' | 'status';

interface SupportEvent {
  conversationId: string;
  type: SupportEventType;
  data: Record<string, unknown>;
}

/**
 * Live events of a handed-off conversation (CHAT_SUPPORT.md §1.7): a staff reply or a requester's message (`message`),
 * a claim or a close (`status`). Like the notification stream, every process publishes through Redis, so a stream gets
 * the event whichever instance wrote it. Events carry only ids and the new status: the client refetches the thread.
 *
 * Two ways out: the conversation's own stream (GET /support/conversations/:id/events), which visitors use, and a
 * `support` event on the notification stream signed-in users already hold: the requester's, and every responder's once
 * it was passed to the team. So nobody signed in needs a second connection.
 */
@Injectable()
export class SupportEventsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(SupportEventsService.name);
  private readonly events = new Subject<SupportEvent>();
  private readonly shutdown = new Subject<void>();
  private subscriber?: Redis;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationStreamService,
  ) {}

  async onModuleInit() {
    this.subscriber = this.redis.getClient().duplicate();
    this.subscriber.on('pmessage', (_pattern, channel: string, message: string) => {
      const event = parse(channel, message);
      if (event) this.events.next(event);
    });
    try {
      await this.subscriber.psubscribe(`${CHANNEL_PREFIX}*`);
    } catch (error) {
      this.logger.warn(`Support channels not subscribed yet: ${(error as Error).message}`);
    }
  }

  async onApplicationShutdown() {
    this.shutdown.next();
    this.shutdown.complete();
    await this.subscriber?.quit().catch(() => undefined);
  }

  /** Never throws: a missed event only delays a refetch. */
  async publish(conversationId: string, type: SupportEventType, data: Record<string, unknown> = {}): Promise<void> {
    try {
      await this.redis.getClient().publish(`${CHANNEL_PREFIX}${conversationId}`, JSON.stringify({ type, data }));
    } catch (error) {
      this.logger.warn(`Support event not published: ${(error as Error).message}`);
      this.events.next({ conversationId, type, data });
    }
    await this.signalUsers(conversationId, type, data);
  }

  /** The signed-in people who may be watching it: the requester, and the responders once it reached the team. */
  private async signalUsers(conversationId: string, type: SupportEventType, data: Record<string, unknown>) {
    try {
      const conversation = await this.prisma.supportConversation.findUnique({
        where: { id: conversationId },
        select: { userId: true, handedOffAt: true },
      });
      if (!conversation) return;
      const responders = conversation.handedOffAt
        ? await this.prisma.admin.findMany({
            where: {
              role: { in: ['ADMIN', 'SUPER_ADMIN'] },
              userId: { not: SYSTEM_ACTOR_ID },
              user: { status: 'ACTIVE' },
            },
            select: { userId: true },
          })
        : [];
      const userIds = [conversation.userId, ...responders.map((admin) => admin.userId)].filter(
        (id): id is string => Boolean(id),
      );
      await this.notifications.publishSupport(userIds, { ...data, conversationId, type });
    } catch (error) {
      this.logger.warn(`Support signal not sent: ${(error as Error).message}`);
    }
  }

  stream(conversationId: string): Observable<MessageEvent> {
    const events = this.events.pipe(
      filter((event) => event.conversationId === conversationId),
      map((event): MessageEvent => ({ type: event.type, data: event.data })),
    );
    const heartbeat = interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'ping', data: {} })));
    return merge(events, heartbeat).pipe(takeUntil(this.shutdown));
  }
}

function parse(channel: string, message: string): SupportEvent | null {
  if (!channel.startsWith(CHANNEL_PREFIX)) return null;
  const conversationId = channel.slice(CHANNEL_PREFIX.length);
  // Other support:* keys are counters and cooldowns, never published to; anything that isn't an event is ignored.
  try {
    const parsed = JSON.parse(message) as { type?: unknown; data?: unknown };
    if (parsed.type !== 'message' && parsed.type !== 'status') return null;
    return {
      conversationId,
      type: parsed.type,
      data: parsed.data && typeof parsed.data === 'object' ? (parsed.data as Record<string, unknown>) : {},
    };
  } catch {
    return null;
  }
}
