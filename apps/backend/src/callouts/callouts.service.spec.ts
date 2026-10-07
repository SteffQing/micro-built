import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from 'src/database/prisma.service';
import { CalloutsService, describeChange, lifetimeFrom } from './callouts.service';
import type { CalloutDto } from './callouts.dto';

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`Prisma ${code}`, { code, clientVersion: 'test' });

const NOW = new Date('2026-10-20T12:00:00Z');

const row = (over: Record<string, unknown> = {}) => ({
  id: 'k1',
  kind: 'EDUCATION',
  title: 'Pay early, pay less',
  body: 'An early payment lowers what you owe.',
  highlight: null,
  pinned: false,
  audience: ['CUSTOMER'],
  priority: 1,
  status: 'DRAFT',
  publishedAt: null,
  expiresAt: new Date('2026-10-25T12:00:00Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { user: { name: 'Ada Obi' } },
  ...over,
});

function setup(existing = row()) {
  const tx = {
    callout: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...row(), ...data })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...existing, ...data })),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { createMany: jest.fn() },
  };
  const prisma = {
    callout: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(existing),
      delete: jest.fn().mockResolvedValue({}),
    },
    admin: { findFirst: jest.fn().mockResolvedValue({ userId: 'system' }) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const queue = { add: jest.fn().mockResolvedValue({}) };
  return { prisma, tx, queue, service: new CalloutsService(prisma as unknown as PrismaService, queue as never) };
}

const input = {
  kind: 'EDUCATION' as const,
  title: 'Pay early, pay less',
  body: 'An early payment lowers what you owe.',
  audience: ['CUSTOMER' as const],
};

beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
afterEach(() => jest.useRealTimers());

describe('CalloutsService', () => {
  it('gives a viewer at most three published callouts for their role, none past its date, pinned first, without the dismissed ones', async () => {
    const { prisma, service } = setup();
    await service.forViewer('MARKETER', ['gone']);
    expect(prisma.callout.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PUBLISHED',
          audience: { has: 'MARKETER' },
          OR: [{ pinned: true }, { expiresAt: { gt: NOW } }],
          // A pinned callout can't be dismissed, so it is never left out.
          NOT: { id: { in: ['gone'] }, pinned: false },
        },
        orderBy: [{ pinned: 'desc' }, { priority: 'desc' }, { publishedAt: 'desc' }, { id: 'asc' }],
        take: 3,
      }),
    );
  });

  it('shows the system account nothing', async () => {
    const { prisma, service } = setup();
    expect(await service.forViewer('SYSTEM')).toEqual([]);
    expect(prisma.callout.findMany).not.toHaveBeenCalled();
  });

  it('gives a new callout 7 days and queues its deletion for then', async () => {
    const { tx, queue, service } = setup();
    const draft = await service.create(input, 'admin1');
    expect(draft).toMatchObject({ status: 'DRAFT', publishedAt: null, createdBy: 'Ada Obi' });
    const expires = new Date('2026-10-27T12:00:00Z');
    expect(tx.callout.create.mock.calls[0][0].data.expiresAt).toEqual(expires);
    expect(queue.add).toHaveBeenCalledWith(
      'callout_expire',
      { calloutId: 'k1' },
      expect.objectContaining({ delay: 7 * 24 * 60 * 60 * 1000, jobId: `callout-expire:k1:${expires.getTime()}` }),
    );
  });

  it('queues nothing for a pinned callout, and shows it no date', async () => {
    const { queue, service } = setup();
    const pinned = await service.create({ ...input, status: 'PUBLISHED', pinned: true }, 'a');
    expect(pinned.expiresAt).toBeNull();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('still saves the callout when Redis is down (the hourly sweep deletes it)', async () => {
    const { queue, service } = setup();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    queue.add.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(service.create(input, 'a')).resolves.toMatchObject({ id: 'k1' });
  });

  it('refuses pinning a draft and publishing to no one', async () => {
    const { service } = setup();
    await expect(service.create({ ...input, pinned: true }, 'a')).rejects.toThrow('Only a published callout can be pinned');
    await expect(service.create({ ...input, audience: [], status: 'PUBLISHED' }, 'a')).rejects.toThrow(BadRequestException);
  });

  it('renewing starts the 7 days again and queues the new date', async () => {
    const { tx, queue, service } = setup(row({ status: 'PUBLISHED' }));
    const { after } = await service.update('k1', { renew: true });
    expect(after.expiresAt).toEqual(lifetimeFrom(NOW));
    expect(tx.callout.update.mock.calls[0][0].data.expiresAt).toEqual(lifetimeFrom(NOW));
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('pinning one releases the other pinned callout with a fresh 7 days', async () => {
    const { tx, queue, service } = setup(row({ status: 'PUBLISHED' }));
    tx.callout.findFirst.mockResolvedValueOnce({ id: 'old' });
    await service.update('k1', { pinned: true });
    expect(tx.callout.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'old' },
      data: { pinned: false, expiresAt: lifetimeFrom(NOW) },
    });
    expect(tx.callout.update.mock.calls[1][0].data.pinned).toBe(true);
    expect(queue.add).toHaveBeenCalledWith('callout_expire', { calloutId: 'old' }, expect.anything());
  });

  it('unpublishing unpins it with a fresh 7 days, and pinning a draft is refused', async () => {
    const { queue, service } = setup(row({ status: 'PUBLISHED', pinned: true }));
    const { after } = await service.update('k1', { status: 'DRAFT' });
    expect(after).toMatchObject({ status: 'DRAFT', pinned: false, expiresAt: lifetimeFrom(NOW) });
    expect(queue.add).toHaveBeenCalledTimes(1);

    const draft = setup(row());
    await expect(draft.service.update('k1', { pinned: true })).rejects.toThrow('Only a published callout can be pinned');
  });

  it('turns a pin taken at the same moment into a 409', async () => {
    const { tx, service } = setup(row({ status: 'PUBLISHED' }));
    tx.callout.update.mockRejectedValueOnce(knownError('P2002'));
    await expect(service.update('k1', { pinned: true })).rejects.toThrow(ConflictException);
  });

  it("won't delete a pinned callout", async () => {
    const { prisma, service } = setup(row({ status: 'PUBLISHED', pinned: true }));
    await expect(service.remove('k1')).rejects.toThrow('A pinned callout stays until you unpin it');
    expect(prisma.callout.delete).not.toHaveBeenCalled();
  });

  it('deletes what is past its date and not pinned, as the SYSTEM admin', async () => {
    const { prisma, tx, service } = setup();
    prisma.callout.findMany.mockResolvedValueOnce([{ id: 'k1', title: 'Old news' }]);
    expect(await service.deleteExpired('k1')).toEqual(['k1']);
    expect(prisma.callout.findMany).toHaveBeenCalledWith({
      where: { id: 'k1', pinned: false, expiresAt: { lte: NOW } },
      select: { id: true, title: true },
    });
    // Checked again as it deletes, so a renewal at the same moment wins.
    expect(tx.callout.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['k1'] }, pinned: false, expiresAt: { lte: NOW } },
    });
    expect(tx.auditLog.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ actorId: 'system', action: 'CALLOUT_DELETED', entityId: 'k1' })],
    });
  });

  it('leaves a renewed or pinned callout alone when its old job runs', async () => {
    const { prisma, tx, service } = setup();
    expect(await service.deleteExpired('k1')).toEqual([]);
    expect(prisma.callout.findMany).toHaveBeenCalled();
    expect(tx.callout.deleteMany).not.toHaveBeenCalled();
  });

  it('describes what changed', () => {
    const before = { ...row(), createdBy: 'A', expiresAt: new Date('2026-10-25') } as unknown as CalloutDto;
    expect(describeChange(before, { ...before, status: 'PUBLISHED', pinned: true })).toEqual(['published', 'pinned']);
    expect(describeChange(before, { ...before, audience: ['CUSTOMER'] })).toEqual([]);
    expect(describeChange(before, { ...before, title: 'New' })).toEqual(['edited']);
    expect(describeChange(before, { ...before, expiresAt: new Date('2026-10-30') })).toEqual(['renewed']);
  });
});
