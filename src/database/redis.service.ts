import { Injectable } from '@nestjs/common';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      url: process.env.REDIS_URL!,
      token: process.env.REDIS_TOKEN!,
    });
  }

  async setEx(key: string, value: string, ttlSeconds = 600) {
    await this.client.set(key, value, { ex: ttlSeconds });
  }

  async set(key: string, value: string) {
    await this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async del(key: string) {
    await this.client.del(key);
  }
}
