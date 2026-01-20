import { RedisOptions } from 'ioredis';

export const redisUrl = process.env.REDIS_URL!;

export const redisOptions: RedisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
};

export const redisConfig = {
  host: process.env.RENDER_REDIS_TCP!,
  port: 6379,
  username: process.env.RENDER_REDIS_USERNAME!,
  password: process.env.RENDER_REDIS_TOKEN!,
};
