import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from 'src/database/prisma.service';
import type { SupabaseService } from 'src/database/supabase.service';
import { AuditService } from './audit.service';

function setup(rows: object[] = []) {
  const prisma = {
    auditLog: {
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(rows.length),
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'MB-AAAAA', name: 'John Doe' }]) },
    loan: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const supabase = { signedUrl: jest.fn().mockResolvedValue('https://signed/link') };
  return {
    prisma,
    supabase,
    service: new AuditService(prisma as unknown as PrismaService, supabase as unknown as SupabaseService),
  };
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

describe('AuditService.fileLink', () => {
  const origin = { ip: '102.89.1.1', userAgent: 'Firefox' };

  it('signs a 5-minute link to the kept sheet and audits the download', async () => {
    const { prisma, supabase, service } = setup();
    prisma.auditLog.findUnique.mockResolvedValue({
      id: 'e1',
      entityType: 'CUSTOMER_IMPORT',
      entityId: 'IMP-ABC123',
      meta: { storedFile: { bucket: 'customer-imports', path: 'IMP-ABC123/customers.xlsx' } },
    });
    await expect(service.fileLink('e1', 'AD-1', origin)).resolves.toEqual({
      url: 'https://signed/link',
      fileName: 'customers.xlsx',
    });
    expect(supabase.signedUrl).toHaveBeenCalledWith('customer-imports', 'IMP-ABC123/customers.xlsx', 300, 'customers.xlsx');
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'AD-1',
        action: 'DATA_EXPORTED',
        entityType: 'CUSTOMER_IMPORT',
        entityId: 'IMP-ABC123',
        meta: { auditEntryId: 'e1', fileName: 'customers.xlsx', ...origin },
      }),
    });
  });

  it('never signs a bucket outside the audit files (a database export is not re-handed out)', async () => {
    const { prisma, supabase, service } = setup();
    prisma.auditLog.findUnique.mockResolvedValue({
      id: 'e2',
      entityType: 'DATABASE',
      entityId: 'DBX-1',
      meta: { storedFile: { bucket: 'database-exports', path: 'DBX-1/db.xlsx' } },
    });
    await expect(service.fileLink('e2', 'AD-1', origin)).rejects.toBeInstanceOf(NotFoundException);
    expect(supabase.signedUrl).not.toHaveBeenCalled();
  });
});
