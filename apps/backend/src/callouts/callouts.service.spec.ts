import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from 'src/database/prisma.service';
import { CalloutsService, describeChange } from './callouts.service';
import type { CalloutDto } from './callouts.dto';

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`Prisma ${code}`, { code, clientVersion: 'test' });

const row = (over: Partial<CalloutDto> = {}) => ({
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
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { user: { name: 'Ada Obi' } },
  ...over,
});

function setup(existing = row()) {
  const tx = {
    callout: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(async ({ data }: { data: object }) => ({ ...row(), ...data })),
      update: jest.fn(async ({ data }: { data: object }) => ({ ...existing, ...data })),
    },
  };
  const prisma = {
    callout: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(existing),
      delete: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { prisma, tx, service: new CalloutsService(prisma as unknown as PrismaService) };
}

const input = {
  kind: 'EDUCATION' as const,
  title: 'Pay early, pay less',
  body: 'An early payment lowers what you owe.',
  audience: ['CUSTOMER' as const],
};

describe('CalloutsService', () => {
  it('gives a viewer at most three published callouts for their role, pinned first, without the dismissed ones', async () => {
    const { prisma, service } = setup();
    await service.forViewer('MARKETER', ['gone']);
    expect(prisma.callout.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PUBLISHED', audience: { has: 'MARKETER' }, id: { notIn: ['gone'] } },
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

  it('saves a draft by default, stamps publishing, and names its author', async () => {
    const { tx, service } = setup();
    const draft = await service.create(input, 'admin1');
    expect(draft).toMatchObject({ status: 'DRAFT', publishedAt: null, createdBy: 'Ada Obi' });

    await service.create({ ...input, status: 'PUBLISHED' }, 'admin1');
    expect(tx.callout.create.mock.calls[1][0].data.publishedAt).toBeInstanceOf(Date);
    expect(tx.callout.updateMany).not.toHaveBeenCalled();
  });

  it('refuses pinning a draft and publishing to no one', async () => {
    const { service } = setup();
    await expect(service.create({ ...input, pinned: true }, 'a')).rejects.toThrow('Only a published callout can be pinned');
    await expect(service.create({ ...input, audience: [], status: 'PUBLISHED' }, 'a')).rejects.toThrow(BadRequestException);
  });

  it('pinning one unpins the others in the same transaction', async () => {
    const { tx, service } = setup(row({ status: 'PUBLISHED' }));
    await service.update('k1', { pinned: true });
    expect(tx.callout.updateMany).toHaveBeenCalledWith({
      where: { pinned: true, id: { not: 'k1' } },
      data: { pinned: false },
    });
    expect(tx.callout.update.mock.calls[0][0].data.pinned).toBe(true);
  });

  it('unpublishing unpins it, and pinning a draft is refused', async () => {
    const { tx, service } = setup(row({ status: 'PUBLISHED', pinned: true }));
    const { after } = await service.update('k1', { status: 'DRAFT' });
    expect(after).toMatchObject({ status: 'DRAFT', pinned: false });
    expect(tx.callout.updateMany).not.toHaveBeenCalled();

    const draft = setup(row());
    await expect(draft.service.update('k1', { pinned: true })).rejects.toThrow('Only a published callout can be pinned');
  });

  it('turns a pin taken at the same moment into a 409', async () => {
    const { tx, service } = setup(row({ status: 'PUBLISHED' }));
    tx.callout.update.mockRejectedValueOnce(knownError('P2002'));
    await expect(service.update('k1', { pinned: true })).rejects.toThrow(ConflictException);
  });

  it('describes what changed', () => {
    const before = { ...row(), createdBy: 'A' } as CalloutDto;
    expect(describeChange(before, { ...before, status: 'PUBLISHED', pinned: true })).toEqual(['published', 'pinned']);
    expect(describeChange(before, { ...before, audience: ['CUSTOMER'] })).toEqual([]);
    expect(describeChange(before, { ...before, title: 'New' })).toEqual(['edited']);
  });
});
