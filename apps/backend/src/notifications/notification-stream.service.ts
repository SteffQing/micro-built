import { Injectable, Logger, MessageEvent, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { filter, interval, map, merge, Observable, Subject, takeUntil } from 'rxjs';
import { RedisService } from 'src/database/redis.service';

/** Redis channel carrying the ids of users whose notifications changed (JSON string[]). */
const CHANNEL = 'mb:notifications:changed';
/** Keeps idle streams open through proxies that drop a silent connection (Railway's edge, browsers). */
const HEARTBEAT_MS = 25_000;

/**
 * Live notification signal for GET /user/notifications/stream (SSE).
 *
 * Writers (InappService) publish the ids of users whose notifications changed; every API instance — and the Bull
 * workers, which write notifications too — goes through Redis pub/sub, so a stream gets the signal whichever process
 * wrote the row. The event says only that something changed; the client refetches the list it already reads.
 */
@Injectable()
export class NotificationStreamService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationStreamService.name);
  private readonly changed = new Subject<string[]>();
  private readonly shutdown = new Subject<void>();
  private subscriber?: Redis;

  constructor(private readonly redis: RedisService) {}

  async onModuleInit() {
    // Subscribing takes a connection over, so it gets its own.
    this.subscriber = this.redis.getClient().duplicate();
    this.subscriber.on('message', (_channel, message: string) => {
      const userIds = parseUserIds(message);
      if (userIds.length > 0) this.changed.next(userIds);
    });
    try {
      await this.subscriber.subscribe(CHANNEL);
    } catch (error) {
      // ioredis resubscribes when the connection comes back; streams still get this process's own changes.
      this.logger.warn(`Notification channel not subscribed yet: ${(error as Error).message}`);
    }
  }

  async onApplicationShutdown() {
    this.shutdown.next();
    this.shutdown.complete();
    await this.subscriber?.quit().catch(() => undefined);
  }

  /** Tell these users' open streams their notifications changed. Never throws: a missed signal only delays a refetch. */
  async publish(userIds: string[]): Promise<void> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return;
    try {
      await this.redis.getClient().publish(CHANNEL, JSON.stringify(ids));
    } catch (error) {
      this.logger.warn(`Notification signal not published: ${(error as Error).message}`);
      this.changed.next(ids);
    }
  }

  /** One user's stream: a `notifications` event per change, and a `ping` every 25 s. */
  stream(userId: string): Observable<MessageEvent> {
    const changes = this.changed.pipe(
      filter((ids) => ids.includes(userId)),
      map((): MessageEvent => ({ type: 'notifications', data: { changed: true } })),
    );
    const heartbeat = interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'ping', data: {} })));
    return merge(changes, heartbeat).pipe(takeUntil(this.shutdown));
  }
}

function parseUserIds(message: string): string[] {
  try {
    const parsed: unknown = JSON.parse(message);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
