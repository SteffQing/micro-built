import { RedisOptions } from 'ioredis';

export const redisUrl = process.env.REDIS_URL!;

export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  tls: redisUrl.startsWith('rediss://')
    ? { rejectUnauthorized: false }
    : undefined,
};
