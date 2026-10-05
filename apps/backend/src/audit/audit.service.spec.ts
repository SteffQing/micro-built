import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from 'src/database/prisma.service';
import { AuditService } from './audit.service';

function setup(rows: object[] = []) {
  const prisma = {
    auditLog: {
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(rows.length),
      create: jest.fn().mockResolvedValue({}),
    },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'MB-AAAAA', name: 'John Doe' }]) },
    loan: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { prisma, service: new AuditService(prisma as unknown as PrismaService) };
}

const row = {
  id: 'a1',
  action: 'CUSTOMER_STATUS_CHANGED',
  entityType: 'USER',
  entityId: 'MB-AAAAA',
  note: null,
  meta: null,
  createdAt: new Date('2026-10-05T10:00:00Z'),
  actor: { userId: 'super-1', role: 'SUPER_ADMIN', user: { name: 'Boss' } },
};

describe('AuditService', () => {
  it('reads whole Lagos days: from midnight of the first to midnight after the last', async () => {
    const { prisma, service } = setup();
    await service.list({ from: '2026-10-01', to: '2026-10-05', action: 'LOAN_APPROVED' });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          actorId: undefined,
          action: 'LOAN_APPROVED',
          entityType: undefined,
          entityId: undefined,
          createdAt: { gte: new Date('2026-09-30T23:00:00Z'), lt: new Date('2026-10-05T23:00:00Z') },
        },
      }),
    );
  });

  it('400s when the range runs backwards', async () => {
    await expect(setup().service.list({ from: '2026-10-05', to: '2026-10-01' })).rejects.toThrow(BadRequestException);
  });

  it('names the person a USER entry is about, and the actor', async () => {
    const { service } = setup([row]);
    const { items } = await service.list({});
    expect(items[0]).toMatchObject({
      entityLabel: 'John Doe',
      actor: { id: 'super-1', name: 'Boss', role: 'SUPER_ADMIN' },
    });
  });
});
