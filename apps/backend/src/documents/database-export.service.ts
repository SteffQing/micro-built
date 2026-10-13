import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Job, Queue } from 'bull';
import { createHash } from 'node:crypto';
import * as officeCrypto from 'officecrypto-tool';
import { DATABASE_EXPORTS_BUCKET } from 'src/audit/audit.files';
import { AuditService } from 'src/audit/audit.service';
import { captureJobError } from 'src/common/observability';
import {
  QueueName,
  ReportQueueName,
  type DatabaseExportCleanupJob,
  type DatabaseExportJob,
} from 'src/common/types/queue.interface';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { LedgerClock } from 'src/ledger/ledger.clock';
import { InappService } from 'src/notifications/inapp.service';
import { databaseWorkbook, openPassword, pageQuery, WITHHELD_COLUMNS, type TableDump } from './database-export';
import { lagosDateTime, lagosDay, XLSX_MIME } from './spreadsheet';

/** How long the download link works; the file is deleted a little after. */
export const DATABASE_EXPORT_LINK_SECONDS = 60 * 60;
const CLEANUP_DELAY_MS = (DATABASE_EXPORT_LINK_SECONDS + 5 * 60) * 1000;
/** Rows read per query. */
const PAGE = 5000;
/** The snapshot stays open while every table is read. */
const SNAPSHOT_TIMEOUT_MS = 15 * 60 * 1000;

// Runs a super admin's database export (the reports queue's database_export job): every table from one read-only
// snapshot, into one workbook locked with the password they chose, handed to them alone as a 1-hour link. Every step
// that matters is in the audit log under the export's reference (DBX-…).
@Injectable()
export class DatabaseExportService {
  private readonly logger = new Logger(DatabaseExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly inapp: InappService,
    private readonly audit: AuditService,
    private readonly clock: LedgerClock,
  ) {}

  async run(job: Job<DatabaseExportJob>) {
    const { exportId, requestedById, reason, sealedPassword } = job.data;
    const startedAt = Date.now();
    const password = openPassword(sealedPassword);
    const requester = await this.prisma.user.findUnique({ where: { id: requestedById }, select: { name: true } });

    const dumps = await this.readSnapshot();
    await job.progress(60);
    const madeAt = this.clock.now();
    const workbook = databaseWorkbook(dumps, {
      exportId,
      madeAt: lagosDateTime(madeAt),
      madeBy: requester?.name ?? requestedById,
      reason,
    });
    const body = await officeCrypto.encrypt(workbook.body, { password });
    await job.progress(80);

    const fileName = `microbuilt-database-${lagosDay(madeAt)}-${exportId}.xlsx`;
    const path = `${exportId}/${fileName}`;
    await this.supabase.uploadPrivate(DATABASE_EXPORTS_BUCKET, path, body, XLSX_MIME);
    // Deleted once the link has expired, whatever happens next: a whole-database copy doesn't sit in storage.
    await (job.queue as unknown as Queue<DatabaseExportCleanupJob>).add(
      ReportQueueName.database_export_cleanup,
      { exportId, bucket: DATABASE_EXPORTS_BUCKET, path } satisfies DatabaseExportCleanupJob,
      { delay: CLEANUP_DELAY_MS, attempts: 5, backoff: { type: 'exponential', delay: 60_000 }, removeOnComplete: true },
    );
    const url = await this.supabase.signedUrl(DATABASE_EXPORTS_BUCKET, path, DATABASE_EXPORT_LINK_SECONDS, fileName);
    const expiresAt = new Date(madeAt.getTime() + DATABASE_EXPORT_LINK_SECONDS * 1000);

    await this.audit.record({
      actorId: requestedById,
      action: 'DATABASE_EXPORT_DELIVERED',
      entityType: 'DATABASE',
      entityId: exportId,
      note: `${workbook.tables.length} tables, ${workbook.totalRows} rows; link sent in-app, valid until ${lagosDateTime(expiresAt)}`,
      meta: {
        exportId,
        fileName,
        fileSize: body.length,
        sha256: createHash('sha256').update(body).digest('hex'),
        tables: workbook.tables.map(({ table, rows }) => ({ table, rows })),
        totalRows: workbook.totalRows,
        truncatedCells: workbook.truncatedCells,
        withheld: WITHHELD_COLUMNS as unknown as Prisma.InputJsonObject,
        linkExpiresAt: expiresAt.toISOString(),
        deletedAfter: new Date(madeAt.getTime() + CLEANUP_DELAY_MS).toISOString(),
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      },
    });
    // In-app only: an emailed link to the whole database would sit in a mailbox.
    await this.inapp.messageUser({
      userId: requestedById,
      title: 'Database export ready',
      message:
        `Export ${exportId} (${workbook.tables.length} tables, ${workbook.totalRows} rows) is ready. It opens with the ` +
        'password you chose. The link works for 1 hour; after that the file is deleted.',
      callToActionUrl: url,
    });
    await job.progress(100);
    return { exportId, tables: workbook.tables.length, rows: workbook.totalRows, bytes: body.length };
  }

  /** Removes an export's file once its link has expired. */
  async cleanup(job: Job<DatabaseExportCleanupJob>) {
    const { bucket, path, exportId } = job.data;
    await this.supabase.removePrivate(bucket, path);
    this.logger.log(`Database export ${exportId}: file deleted`);
  }

  /** The export didn't finish: audited, and the super admin is told. Never throws. */
  async failed(job: Job<Partial<DatabaseExportJob>>, error: Error): Promise<void> {
    const { exportId, requestedById } = job.data ?? {};
    if (!exportId || !requestedById) return;
    try {
      await this.audit.record({
        actorId: requestedById,
        action: 'DATABASE_EXPORT_FAILED',
        entityType: 'DATABASE',
        entityId: exportId,
        note: `The export did not finish: ${error.message}`,
        meta: { exportId, error: error.message },
      });
      await this.inapp.messageUser({
        userId: requestedById,
        title: "Your database export couldn't be made",
        message: `Export ${exportId} did not finish. Nothing was handed out. Request it again; if it keeps failing, contact support.`,
      });
    } catch (failure) {
      this.logger.error(`Recording database export ${exportId}'s failure failed`, failure instanceof Error ? failure.stack : failure);
      captureJobError(failure, { queue: QueueName.reports, job: 'database-export-failed' });
    }
  }

  /** Every table in the schema, read in one repeatable-read, read-only transaction: one consistent moment. */
  private async readSnapshot(): Promise<TableDump[]> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        const columns = await tx.$queryRaw<{ table_name: string; column_name: string }[]>`
          SELECT c.table_name, c.column_name
          FROM information_schema.columns c
          JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
          WHERE c.table_schema = current_schema() AND t.table_type = 'BASE TABLE'
          ORDER BY c.table_name, c.ordinal_position`;
        const byTable = new Map<string, string[]>();
        for (const { table_name, column_name } of columns) {
          byTable.set(table_name, [...(byTable.get(table_name) ?? []), column_name]);
        }

        const dumps: TableDump[] = [];
        for (const [table, tableColumns] of [...byTable].sort(([a], [b]) => a.localeCompare(b))) {
          const sql = pageQuery(table, tableColumns);
          const rows: (string | null)[][] = [];
          for (let offset = 0; ; offset += PAGE) {
            const page = await tx.$queryRawUnsafe<{ r: (string | null)[] }[]>(sql, PAGE, offset);
            for (const { r } of page) rows.push(r);
            if (page.length < PAGE) break;
          }
          dumps.push({ table, columns: tableColumns, rows });
        }
        return dumps;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10_000, timeout: SNAPSHOT_TIMEOUT_MS },
    );
  }
}
