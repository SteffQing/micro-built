import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import type { AuditEntry, Tx } from 'src/ledger/ledger.tx';
import type { AuditEntryDto, AuditQueryDto } from './audit.dto';

/** Lagos is UTC+1 all year: a Lagos day starts at 23:00 UTC the day before. */
function lagosDayStart(day: string): Date {
  return new Date(`${day}T00:00:00+01:00`);
}

// The audit log outside the ledger (settings, the commodity catalogue, onboarding, imports,
// exports) and the super admins' view of all of it. Money and decision entries are written by the
// ledger's own LedgerTx.audit, in the ledger's transactions.
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Writes one entry, inside `db` when the change it records is in a transaction. */
  async record(entry: AuditEntry, db: Tx | PrismaService = this.prisma): Promise<void> {
    await db.auditLog.create({ data: entry });
  }

  async list(query: AuditQueryDto): Promise<{ items: AuditEntryDto[]; meta: { total: number; page: number; limit: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('The start date must be on or before the end date');
    }
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = lagosDayStart(query.from);
    if (query.to) createdAt.lt = new Date(lagosDayStart(query.to).getTime() + 24 * 60 * 60 * 1000);
    const where: Prisma.AuditLogWhereInput = {
      actorId: query.actorId,
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      ...(Object.keys(createdAt).length > 0 && { createdAt }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { userId: true, role: true, user: { select: { name: true } } } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const labels = await this.labels(rows);
    const items = rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      entityLabel: labels.get(`${row.entityType}:${row.entityId}`) ?? null,
      note: row.note,
      meta: (row.meta as Record<string, unknown> | null) ?? null,
      actor: { id: row.actor.userId, name: row.actor.user.name, role: row.actor.role },
      createdAt: row.createdAt,
    }));
    return { items, meta: { total, page, limit } };
  }

  /** "TYPE:id" → the person the record belongs to, for users and loans on the page. */
  private async labels(rows: { entityType: string; entityId: string }[]): Promise<Map<string, string>> {
    const ids = (type: string) => [...new Set(rows.filter((r) => r.entityType === type).map((r) => r.entityId))];
    const userIds = ids('USER');
    const loanIds = ids('LOAN');
    const [users, loans] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
        : [],
      loanIds.length
        ? this.prisma.loan.findMany({
            where: { id: { in: loanIds } },
            select: { id: true, borrower: { select: { user: { select: { name: true } } } } },
          })
        : [],
    ]);
    return new Map([
      ...users.map((u) => [`USER:${u.id}`, u.name] as const),
      ...loans.map((l) => [`LOAN:${l.id}`, l.borrower.user.name] as const),
    ]);
  }
}
