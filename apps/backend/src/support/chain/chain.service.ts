import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from 'src/database/redis.service';
import { lagosDay } from '../limits';
import { loadFactories, parseChain, type ChainLink, type ProviderName } from './links';
import type { CooldownStore } from './run';

/** Daily 429 counters, read by the analytics; kept 35 days. */
export const quotaKey = (day: string, provider: string) => `support:quota:${day}:${provider}`;
const QUOTA_TTL_S = 35 * 24 * 60 * 60;
const cooldownKey = (linkId: string) => `support:cooldown:${linkId}`;

/**
 * The configured chain, parsed once at boot (links without a key are logged once and left out), with its cooldowns
 * and quota counters in Redis. Without Redis no link is ever cooling: the chain still answers.
 */
@Injectable()
export class SupportChainService implements OnModuleInit, CooldownStore {
  private readonly logger = new Logger(SupportChainService.name);
  links: ChainLink[] = [];

  constructor(private readonly redis: RedisService) {}

  async onModuleInit() {
    const { links, skipped } = parseChain(undefined, undefined, await loadFactories());
    this.links = links;
    if (process.env.SUPPORT_ENABLED !== 'true') return;
    for (const reason of skipped) this.logger.warn(`Support chain link skipped: ${reason}`);
    if (links.length === 0) this.logger.warn('Support chain has no usable link: every reply will be the busy one');
  }

  /** The lightest model: the last link, which also answers the guard's questions when the guard is down. */
  get lightest(): ChainLink | undefined {
    return this.links[this.links.length - 1];
  }

  async isCooling(linkId: string): Promise<boolean> {
    try {
      return (await this.redis.get(cooldownKey(linkId))) !== null;
    } catch {
      return false;
    }
  }

  async cool(linkId: string, seconds: number): Promise<void> {
    try {
      await this.redis.setEx(cooldownKey(linkId), '1', Math.max(1, Math.round(seconds)));
    } catch (error) {
      this.logger.warn(`Cooldown for ${linkId} not stored: ${(error as Error).message}`);
    }
  }

  async quotaHit(provider: ProviderName): Promise<void> {
    try {
      const key = quotaKey(lagosDay(), provider);
      const client = this.redis.getClient();
      if ((await client.incr(key)) === 1) await client.expire(key, QUOTA_TTL_S);
    } catch {
      // Analytics only.
    }
  }
}
