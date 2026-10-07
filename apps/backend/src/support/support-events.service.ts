import { Injectable, Logger, MessageEvent, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { filter, interval, map, merge, Observable, Subject, takeUntil } from 'rxjs';
import { RedisService } from 'src/database/redis.service';

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
 */
@Injectable()
export class SupportEventsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(SupportEventsService.name);
  private readonly events = new Subject<SupportEvent>();
  private readonly shutdown = new Subject<void>();
  private subscriber?: Redis;

  constructor(private readonly redis: RedisService) {}

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
