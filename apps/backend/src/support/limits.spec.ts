import { HttpStatus, Logger } from '@nestjs/common';
import type { RedisService } from 'src/database/redis.service';
import type { SupportCaller } from './caller';
import { SupportLimitError, SupportLimits, lagosDay } from './limits';
import { SUPPORT_LIMITS } from './support.dto';

function fakeRedis() {
  const store = new Map<string, number>();
  const client = {
    incr: jest.fn(async (key: string) => {
      store.set(key, (store.get(key) ?? 0) + 1);
      return store.get(key);
    }),
    expire: jest.fn(async () => 1),
  };
  const redis = {
    getClient: () => client,
    get: jest.fn(async (key: string) => (store.has(key) ? String(store.get(key)) : null)),
  } as unknown as RedisService;
  return { redis, client, store };
}

const customer = { audience: 'CUSTOMER', restricted: false, user: { userId: 'u1' }, visitorId: null, ip: '1.1.1.1' } as SupportCaller;
const admin = { ...customer, audience: 'ADMIN', user: { userId: 'a1' } } as SupportCaller;
const visitor = { audience: 'ANONYMOUS', restricted: false, user: null, visitorId: 'v', ip: '9.9.9.9' } as SupportCaller;

describe('SupportLimits', () => {
  it('gives a customer 40 messages a Lagos day, then a 429 with a plain sentence', async () => {
    const { redis, client } = fakeRedis();
    const limits = new SupportLimits(redis);
    for (let i = 0; i < SUPPORT_LIMITS.customerMessagesPerDay; i++) await limits.takeMessage(customer);
    expect(client.expire).toHaveBeenCalledTimes(1);
    const error = await limits.takeMessage(customer).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SupportLimitError);
    expect((error as SupportLimitError).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect((error as SupportLimitError).message).toMatch(/today's 40 messages/);
    expect(client.incr).toHaveBeenCalledWith(`support:limit:user:u1:${lagosDay()}`);
    expect(await limits.remainingToday(customer)).toBe(0);
  });

  it('gives staff 150 a day', async () => {
    const { redis } = fakeRedis();
    const limits = new SupportLimits(redis);
    expect(await limits.remainingToday(admin)).toBe(SUPPORT_LIMITS.staffMessagesPerDay);
    await limits.takeMessage(admin);
    expect(await limits.remainingToday(admin)).toBe(149);
  });

  it('limits visitors per IP: 15 messages an hour and 5 new conversations a day', async () => {
    const { redis } = fakeRedis();
    const limits = new SupportLimits(redis);
    for (let i = 0; i < 15; i++) await limits.takeMessage(visitor);
    await expect(limits.takeMessage(visitor)).rejects.toThrow(/in the last hour/);
    for (let i = 0; i < 5; i++) await limits.takeConversation(visitor);
    await expect(limits.takeConversation(visitor)).rejects.toThrow(/most conversations allowed today/);
    // Another IP has its own allowance.
    await expect(limits.takeMessage({ ...visitor, ip: '8.8.8.8' })).resolves.toBeUndefined();
    // Signed-in callers have no conversation limit.
    await expect(limits.takeConversation(customer)).resolves.toBeUndefined();
    expect(await limits.remainingToday(visitor)).toBeUndefined();
  });

  it('lets the message through when Redis is down', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const redis = { getClient: () => ({ incr: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) }) } as unknown as RedisService;
    await expect(new SupportLimits(redis).takeMessage(customer)).resolves.toBeUndefined();
  });

  it('counts the Lagos day, which starts at 23:00 UTC', () => {
    expect(lagosDay(new Date('2026-10-07T22:59:00Z'))).toBe('2026-10-07');
    expect(lagosDay(new Date('2026-10-07T23:00:00Z'))).toBe('2026-10-08');
  });
});
