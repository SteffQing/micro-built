import { ConflictException } from '@nestjs/common';
import type { DatabaseExportJob } from 'src/common/types/queue.interface';
import { openPassword } from 'src/documents/database-export';
import { DatabaseExportRequestService, EXPORT_IN_PROGRESS } from './database-export.service';

const ORIGIN = { ip: '102.89.1.1', userAgent: 'Firefox' };

function setup(queued = true) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ name: 'Ada Obi' }) },
    admin: { findMany: jest.fn().mockResolvedValue([{ userId: 'AD-2' }, { userId: 'AD-3' }]) },
  };
  const queue = { queueDatabaseExport: jest.fn().mockResolvedValue(queued) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const inapp = { messageUsers: jest.fn().mockResolvedValue(undefined) };
  const service = new DatabaseExportRequestService(prisma as never, queue as never, audit as never, inapp as never);
  return { prisma, queue, audit, inapp, service };
}

describe('DatabaseExportRequestService', () => {
  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET ??= 'test-secret-'.padEnd(40, 'x');
  });

  it('queues the export with the password sealed, audits who, why and from where, and tells the other super admins', async () => {
    const { prisma, queue, audit, inapp, service } = setup();
    const { exportId } = await service.request('AD-1', { reason: 'Offline backup', password: 'correct horse battery' }, ORIGIN);

    expect(exportId).toMatch(/^DBX-[0-9A-Z]{6}$/);
    const job = queue.queueDatabaseExport.mock.calls[0][0] as DatabaseExportJob;
    expect(job).toMatchObject({ exportId, requestedById: 'AD-1', reason: 'Offline backup' });
    expect(JSON.stringify(job)).not.toContain('correct horse battery');
    expect(openPassword(job.sealedPassword)).toBe('correct horse battery');

    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'AD-1',
      action: 'DATABASE_EXPORT_REQUESTED',
      entityType: 'DATABASE',
      entityId: exportId,
      note: 'Offline backup',
      meta: { exportId, ...ORIGIN },
    });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('correct horse battery');

    // Never the requester or the SYSTEM actor.
    expect(prisma.admin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: { notIn: ['system', 'AD-1'] } }) }),
    );
    expect(inapp.messageUsers).toHaveBeenCalledWith(
      ['AD-2', 'AD-3'],
      expect.objectContaining({
        title: 'Database export requested',
        message: expect.stringContaining(`Ada Obi asked for a full database export (${exportId})`),
      }),
    );
  });

  it('refuses a second export while one is being made, and records nothing', async () => {
    const { audit, inapp, service } = setup(false);
    await expect(service.request('AD-1', { reason: 'Again', password: 'correct horse battery' }, ORIGIN)).rejects.toThrow(
      new ConflictException(EXPORT_IN_PROGRESS),
    );
    expect(audit.record).not.toHaveBeenCalled();
    expect(inapp.messageUsers).not.toHaveBeenCalled();
  });
});
