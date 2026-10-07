import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/database/redis.service';
import type { SupportCaller } from './caller';
import { SUPPORT_LIMITS } from './support.dto';

const HOUR_S = 60 * 60;
const DAY_S = 24 * HOUR_S;

/** "2026-10-07": the Lagos day (UTC+1, no daylight saving) `at` falls on. */
export const lagosDay = (at = new Date()) => new Date(at.getTime() + HOUR_S * 1000).toISOString().slice(0, 10);
/** "2026-10-07T09": the Lagos hour. */
const lagosHour = (at = new Date()) => new Date(at.getTime() + HOUR_S * 1000).toISOString().slice(0, 13);

export class SupportLimitError extends HttpException {
  constructor(message: string) {
    super({ statusCode: HttpStatus.TOO_MANY_REQUESTS, error: 'Too Many Requests', message }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

interface Counter {
  key: string;
  limit: number;
  ttl: number;
  message: string;
}

/**
 * The chat's per-caller limits (C7) as Redis counters: visitors per IP (messages an hour, new conversations a day),
 * signed-in callers per Lagos day. A counter is taken before the work, so a refused message costs nothing. Without
 * Redis the limits are skipped (logged), never the chat.
 */
@Injectable()
export class SupportLimits {
  private readonly logger = new Logger(SupportLimits.name);

  constructor(private readonly redis: RedisService) {}

  dailyLimit(caller: SupportCaller): number | null {
    if (!caller.user) return null;
    return caller.audience === 'CUSTOMER' ? SUPPORT_LIMITS.customerMessagesPerDay : SUPPORT_LIMITS.staffMessagesPerDay;
  }

  /** Messages a signed-in caller has left today; undefined for visitors. */
  async remainingToday(caller: SupportCaller): Promise<number | undefined> {
    const limit = this.dailyLimit(caller);
    if (limit === null || !caller.user) return undefined;
    try {
      const used = Number((await this.redis.get(this.userKey(caller.user.userId))) ?? 0);
      return Math.max(0, limit - used);
    } catch {
      return limit;
    }
  }

  /** Takes one message from the caller's allowance, or throws 429 with a plain sentence. */
  async takeMessage(caller: SupportCaller): Promise<void> {
    if (caller.user) {
      const limit = this.dailyLimit(caller) as number;
      return this.take({
        key: this.userKey(caller.user.userId),
        limit,
        ttl: DAY_S + HOUR_S,
        message: `You've sent today's ${limit} messages to the assistant. Try again tomorrow, or email the team.`,
      });
    }
    if (!caller.ip) return;
    return this.take({
      key: `support:limit:ip-msg:${caller.ip}:${lagosHour()}`,
      limit: SUPPORT_LIMITS.visitorMessagesPerHour,
      ttl: HOUR_S + 60,
      message: "You've sent a lot of messages in the last hour. Wait a little, or sign in to keep going.",
    });
  }

  /** Visitors: three new conversations a day per IP. */
  async takeConversation(caller: SupportCaller): Promise<void> {
    if (caller.user || !caller.ip) return;
    return this.take({
      key: `support:limit:ip-conv:${caller.ip}:${lagosDay()}`,
      limit: SUPPORT_LIMITS.visitorConversationsPerDay,
      ttl: DAY_S + HOUR_S,
      message: "You've started the most conversations allowed today. Carry on in one of them, or sign in.",
    });
  }

  private userKey(userId: string) {
    return `support:limit:user:${userId}:${lagosDay()}`;
  }

  private async take({ key, limit, ttl, message }: Counter): Promise<void> {
    let count: number;
    try {
      const client = this.redis.getClient();
      count = await client.incr(key);
      if (count === 1) await client.expire(key, ttl);
    } catch (error) {
      this.logger.warn(`Support limit not checked: ${(error as Error).message}`);
      return;
    }
    if (count > limit) throw new SupportLimitError(message);
  }
}
