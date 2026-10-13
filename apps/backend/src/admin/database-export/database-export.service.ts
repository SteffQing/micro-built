import { ConflictException, Injectable } from '@nestjs/common';
import { AuditService } from 'src/audit/audit.service';
import type { RequestOrigin } from 'src/audit/request-origin';
import { generateId } from 'src/common/utils';
import { PrismaService } from 'src/database/prisma.service';
import { sealPassword } from 'src/documents/database-export';
import { SYSTEM_ACTOR_ID } from 'src/ledger/ledger.constants';
import { InappService } from 'src/notifications/inapp.service';
import { QueueProducer } from 'src/queue/bull/queue.producer';

export const EXPORT_IN_PROGRESS = 'A database export is already being made. Wait for it to finish, then ask again';

// Asking for a whole-database export (the work is DatabaseExportService's, on the reports queue). It is the riskiest
// thing the platform hands out, so the request is audited with who, why and from where, and every other super admin
// is told at once: an export nobody expected is seen.
@Injectable()
export class DatabaseExportRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueProducer,
    private readonly audit: AuditService,
    private readonly inapp: InappService,
  ) {}

  async request(
    requestedById: string,
    input: { reason: string; password: string },
    origin: RequestOrigin,
  ): Promise<{ exportId: string }> {
    const exportId = generateId.databaseExportId();
    const queued = await this.queue.queueDatabaseExport({
      exportId,
      requestedById,
      reason: input.reason,
      sealedPassword: sealPassword(input.password),
    });
    if (!queued) throw new ConflictException(EXPORT_IN_PROGRESS);

    await this.audit.record({
      actorId: requestedById,
      action: 'DATABASE_EXPORT_REQUESTED',
      entityType: 'DATABASE',
      entityId: exportId,
      note: input.reason,
      meta: { exportId, ...origin },
    });

    const [requester, others] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: requestedById }, select: { name: true } }),
      this.prisma.admin.findMany({
        where: {
          role: 'SUPER_ADMIN',
          userId: { notIn: [SYSTEM_ACTOR_ID, requestedById] },
          user: { status: 'ACTIVE' },
        },
        select: { userId: true },
      }),
    ]);
    await this.inapp.messageUsers(
      others.map((admin) => admin.userId),
      {
        title: 'Database export requested',
        message:
          `${requester?.name ?? 'A super admin'} asked for a full database export (${exportId}): "${input.reason}". ` +
          'If you did not expect this, check the audit log and their account now.',
        callToActionUrl: '/audit',
      },
    );
    return { exportId };
  }
}
