import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { ConflictException, HttpException, Logger } from '@nestjs/common';
import { visibleEmail } from '@microbuilt/shared';
import { Prisma, type AdminRole } from '@prisma/client';
import type { Job } from 'bull';
import { randomBytes } from 'node:crypto';
import { AuditService } from 'src/audit/audit.service';
import { AuthAccountsService } from 'src/auth/auth-accounts.service';
import { CommoditiesService } from 'src/commodities/commodities.service';
import { captureJobError } from 'src/common/observability';
import { QueueName, ServicesQueueName } from 'src/common/types/queue.interface';
import type { ExistingCustomerJob, ImportSummary } from 'src/common/types/services.queue.interface';
import { generateId } from 'src/common/utils';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerClock } from 'src/ledger/ledger.clock';
import { LedgerService, type ImportLoan } from 'src/ledger/ledger.service';
import { LedgerTx } from 'src/ledger/ledger.tx';
import { ADMIN_LINKS, AdminNotifierService } from 'src/notifications/admin-notifier.service';
import { InappService } from 'src/notifications/inapp.service';
import { MailService } from 'src/notifications/mail.service';
import { findOrCreateOrganization } from 'src/organizations/organizations';
import { SettingsService } from 'src/settings/settings.service';
import {
  cellText,
  duplicateMessage,
  ImportRowError,
  assetLoansNote,
  importLoanInput,
  importLoanWarning,
  importSummaryText,
  lagosToday,
  matchOfficer,
  parseImportRow,
  sheetRows,
  type ImportRow,
  type Officer,
} from './service.utils';

/** Row errors the uploader is shown (in-app and email); the job's result keeps the same. */
const SUMMARY_ERRORS = 20;
/** Rows the import's closing audit entry lists one by one (customers, errors, warnings each). */
const AUDITED_ROWS = 5000;
/** Unexpected row failures sent to Sentry per job: an outage fails every row the same way. */
const REPORTED_ERRORS = 3;
const UNEXPECTED_ROW_ERROR = 'Not saved because of an unexpected error; upload this row again later';

interface ImportContext {
  /** The import's reference and sheet name, on every audit entry (absent on a job queued before them). */
  importId: string | null;
  fileName: string | null;
  rates: ImportLoan['rates'];
  officers: Officer[];
  actorId: string;
  /** The uploader's role: a super admin's new organizations are ACTIVE, anyone else's wait for one. */
  actorRole: AdminRole;
  /** New organizations the rows committed that wait for a super admin, by id (notified once, at the end). */
  newPending: Map<string, { id: string; name: string; requestedById: string | null }>;
}

/** One row the import onboarded, for its closing audit entry. */
interface ImportedCustomer {
  row: number;
  userId: string;
  name: string;
  ippis: string;
  /** The loan it brought over; null when it was already paid off. */
  loanId: string | null;
}

/** The last four characters, the rest masked: enough to tell records apart in the audit log. */
const lastFour = (value: string) => (value.length > 4 ? `${'*'.repeat(value.length - 4)}${value.slice(-4)}` : value);

/**
 * What the uploader can fix — bad data, a duplicate, an account or loan the services refused —
 * as its message; null for anything unexpected.
 */
function rowProblem(error: unknown): string | null {
  return error instanceof ImportRowError || error instanceof HttpException ? error.message : null;
}

// The existing-customer upload. Each row becomes a customer — an account they sign in to with SMS
// codes, their payroll and bank details — and the loan they were already repaying, brought onto
// the ledger as it stands (LedgerService.importLoan). One transaction per row: a bad row is
// recorded and the rest go on; the uploader gets a summary at the end.
@Processor(QueueName.services)
export class ServicesConsumer {
  private readonly logger = new Logger(ServicesConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly ledger: LedgerService,
    private readonly clock: LedgerClock,
    private readonly settings: SettingsService,
    private readonly commodities: CommoditiesService,
    private readonly accounts: AuthAccountsService,
    private readonly inapp: InappService,
    private readonly mail: MailService,
    private readonly adminNotifier: AdminNotifierService,
    private readonly audit: AuditService,
  ) {}

  @Process(ServicesQueueName.onboard_existing_customers)
  async handleImport(job: Job<ExistingCustomerJob>): Promise<ImportSummary> {
    const actorId = job.data.requestedById;
    // Only a job queued before v2 lacks it; there's no admin to book the loans to.
    if (!actorId) throw new Error('This import was queued without its uploader; upload the sheet again');
    const rates = await this.importRates();
    const { rows, skipped } = sheetRows(job.data);
    const uploader = await this.prisma.admin.findUnique({ where: { userId: actorId }, select: { role: true } });
    const startedAt = Date.now();
    const context: ImportContext = {
      importId: job.data.importId ?? null,
      fileName: job.data.fileName ?? null,
      rates,
      officers: await this.officers(),
      actorId,
      actorRole: uploader?.role ?? 'ADMIN',
      newPending: new Map(),
    };
    const summary: ImportSummary = { total: rows.length, imported: 0, failed: 0, skipped, errors: [], warnings: [] };
    let reported = 0;
    let assetLoans = 0;
    const customers: ImportedCustomer[] = [];

    for (const [index, { rowNumber, record }] of rows.entries()) {
      try {
        const row = parseImportRow(record, lagosToday(this.clock.now()));
        const { userId, loan, loanId } = await this.importRow(row, rowNumber, context);
        summary.imported++;
        customers.push({ row: rowNumber, userId, name: row.name, ippis: row.externalId, loanId });
        if (loan?.category === 'ASSET_PURCHASE') assetLoans++;
        const warning = loan && importLoanWarning(loan);
        if (warning) summary.warnings.push(`Row ${rowNumber} (${cellText(record.name) || 'no name'}): ${warning}`);
      } catch (error) {
        summary.failed++;
        const problem = rowProblem(error);
        if (problem === null) {
          this.logger.error(`Import ${job.id}, row ${rowNumber}`, error instanceof Error ? error.stack : String(error));
          if (reported++ < REPORTED_ERRORS) {
            captureJobError(error, { queue: QueueName.services, job: job.name, jobId: job.id });
          }
        }
        summary.errors.push(`Row ${rowNumber} (${cellText(record.name) || 'no name'}): ${problem ?? UNEXPECTED_ROW_ERROR}`);
      }
      await job.progress(Math.round(((index + 1) / rows.length) * 100));
    }

    if (assetLoans) summary.warnings.unshift(assetLoansNote(assetLoans));

    this.logger.log(
      `Import ${job.id}: ${summary.imported} imported, ${summary.failed} failed, ${summary.skipped} skipped, ` +
        `${summary.warnings.length} warnings`,
    );
    for (const organization of context.newPending.values()) {
      await this.adminNotifier.organizationAwaitingApproval(organization).catch((error: unknown) => {
        this.logger.error('Notifying about a new organization failed', error instanceof Error ? error.stack : error);
        captureJobError(error, { queue: QueueName.services, job: 'import-organization-notify' });
      });
    }
    await this.auditOutcome(job, actorId, {
      action: 'CUSTOMER_IMPORT_FINISHED',
      note:
        `${context.fileName ? `"${context.fileName}": ` : ''}${summary.imported} of ${summary.total} rows imported` +
        (summary.failed ? `, ${summary.failed} failed` : '') +
        (summary.skipped ? `, ${summary.skipped} skipped` : ''),
      meta: {
        total: summary.total,
        imported: summary.imported,
        failed: summary.failed,
        skipped: summary.skipped,
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
        customers: customers.slice(0, AUDITED_ROWS),
        errors: summary.errors.slice(0, AUDITED_ROWS),
        warnings: summary.warnings.slice(0, AUDITED_ROWS),
        ...(Math.max(customers.length, summary.errors.length, summary.warnings.length) > AUDITED_ROWS && {
          truncated: `Only the first ${AUDITED_ROWS} of each list are kept here`,
        }),
      },
    });
    const title = summary.failed ? 'Customer Import Finished With Errors' : 'Customer Import Complete';
    await this.tellUploader(actorId, title, importSummaryText(summary, SUMMARY_ERRORS), summary);
    return {
      ...summary,
      errors: summary.errors.slice(0, SUMMARY_ERRORS),
      warnings: summary.warnings.slice(0, SUMMARY_ERRORS),
    };
  }

  @OnQueueFailed()
  async onFailed(job: Job<Partial<ExistingCustomerJob>>, error: Error): Promise<void> {
    this.logger.error(`${job.name} (${job.id}) failed: ${error.message}`, error.stack);
    captureJobError(error, { queue: QueueName.services, job: job.name, jobId: job.id });
    if (job.name === ServicesQueueName.onboard_existing_customers && job.data?.requestedById) {
      await this.auditOutcome(job, job.data.requestedById, {
        action: 'CUSTOMER_IMPORT_FAILED',
        note: `The import stopped: ${error.message}`,
        // Rows commit one at a time: those before the failure stay imported (their CUSTOMER_ONBOARDED entries).
        meta: { error: error.message, progress: `${Number(job.progress()) || 0}%` },
      });
      await this.tellUploader(
        job.data.requestedById,
        'Customer Import Failed',
        `The customer import did not finish: ${error.message}`,
      );
    }
  }

  /**
   * The import's closing entry, under its reference. Never throws: the import has happened (or failed) either way,
   * and the uploader still needs their summary.
   */
  private async auditOutcome(
    job: Job<Partial<ExistingCustomerJob>>,
    actorId: string,
    entry: { action: 'CUSTOMER_IMPORT_FINISHED' | 'CUSTOMER_IMPORT_FAILED'; note: string; meta: Record<string, unknown> },
  ): Promise<void> {
    const importId = job.data?.importId ?? `job-${job.id}`;
    try {
      await this.audit.record({
        actorId,
        action: entry.action,
        entityType: 'CUSTOMER_IMPORT',
        entityId: importId,
        note: entry.note,
        meta: { importId, fileName: job.data?.fileName ?? null, ...entry.meta } as Prisma.InputJsonObject,
      });
    } catch (error) {
      this.logger.error(`Auditing import ${importId} failed`, error instanceof Error ? error.stack : error);
      captureJobError(error, { queue: QueueName.services, job: 'import-audit' });
    }
  }

  /** The rates imported loans are snapshotted with, for top-ups later; the job fails without them. */
  private async importRates(): Promise<ImportLoan['rates']> {
    try {
      return await this.settings.requireRates();
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new Error('Set the interest and management fee rates in Settings before importing customers');
      }
      throw error;
    }
  }

  /** Who a MARKETER cell can name: every admin but the system actor (as v1, removed admins too). */
  private async officers(): Promise<Officer[]> {
    const admins = await this.prisma.admin.findMany({
      where: { role: { not: 'SYSTEM' } },
      select: { userId: true, user: { select: { name: true } } },
    });
    return admins.map((admin) => ({ id: admin.userId, name: admin.user.name.toLowerCase() }));
  }

  /** The customer it onboarded, and the loan it booked (null when they came over without one: already paid off). */
  private async importRow(
    row: ImportRow,
    rowNumber: number,
    context: ImportContext,
  ): Promise<{ userId: string; loan: ImportLoan | null; loanId: string | null }> {
    // Outside the row's transaction: an asset name seen once stays a commodity even if the row fails.
    const commodityId = row.assetName ? (await this.commodities.ensure(row.assetName)).id : undefined;
    let pending: { id: string; name: string; requestedById: string | null } | null = null;
    try {
      const imported = await this.ledgerTx.transaction(async (tx) => {
        pending = null;
        const user = await this.accounts.createWithPassword(tx, {
          id: generateId.userId(),
          type: 'CUSTOMER',
          name: row.name,
          phoneNumber: row.phoneNumber,
          phoneNumberVerified: false,
          emailVerified: false,
          status: 'ACTIVE',
          // Nobody is told it: imported customers sign in with codes sent to their phone.
          password: randomBytes(24).toString('base64url'),
        });
        const accountOfficerId = matchOfficer(context.officers, row.marketerName);
        await tx.customer.create({
          data: {
            userId: user.id,
            externalId: row.externalId,
            accountOfficerId,
          },
        });
        const named = await findOrCreateOrganization(tx, row.organization, {
          id: context.actorId,
          role: context.actorRole,
        });
        if (named.created && named.status === 'PENDING') pending = named;
        await tx.customerPayroll.create({
          data: { externalId: row.externalId, organizationId: named.id, command: row.command },
        });
        await tx.customerPaymentMethod.create({
          data: {
            userId: user.id,
            bankName: row.bankName,
            accountNumber: row.accountNumber,
            accountName: row.name,
            bvn: row.bvn,
          },
        });
        // A loan already paid off isn't brought over; the customer is onboarded without one.
        const paidOff = row.repaid.gte(row.totalRepayable);
        const loan = paidOff
          ? null
          : importLoanInput(row, {
              borrowerId: user.id,
              actorId: context.actorId,
              rates: context.rates,
              commodityId,
            });
        if (loan && context.importId) loan.note = `${loan.note} (import ${context.importId}, row ${rowNumber})`;
        const booked = loan ? await this.ledger.importLoan(loan, tx) : null;

        const from = context.importId ? `import ${context.importId}` : 'a customer import';
        await this.ledgerTx.audit(tx, {
          actorId: context.actorId,
          action: 'CUSTOMER_ONBOARDED',
          entityType: 'USER',
          entityId: user.id,
          note:
            `Imported from ${from}${context.fileName ? ` ("${context.fileName}")` : ''}, row ${rowNumber}` +
            (paidOff ? ': loan already paid off, not brought over' : ''),
          meta: {
            importId: context.importId,
            fileName: context.fileName,
            row: rowNumber,
            ippis: row.externalId,
            phoneNumber: row.phoneNumber,
            organization: named.name,
            organizationId: named.id,
            organizationCreated: named.created,
            command: row.command,
            bankName: row.bankName,
            accountNumber: lastFour(row.accountNumber),
            bvn: lastFour(row.bvn),
            marketerCell: row.marketerName,
            accountOfficerId,
            loanId: booked?.loanId ?? null,
            loanCategory: loan?.category ?? null,
            ...(row.assetName && { asset: row.assetName }),
            principal: (row.cashPrincipal ?? row.totalRepayable).toString(),
            totalRepayable: row.totalRepayable.toString(),
            repaidBefore: row.repaid.toString(),
            outstanding: booked ? booked.outstanding.toString() : '0',
            monthlyDeduction: booked ? booked.monthly.toString() : '0',
            tenureMonthsLeft: row.tenure,
            startDate: row.startDate.toISOString().slice(0, 10),
            endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
          },
        });
        return { userId: user.id, loan, loanId: booked?.loanId ?? null };
      });
      // Only once the row committed: a rolled-back row's organization was never created.
      const committed = pending as { id: string; name: string; requestedById: string | null } | null;
      if (committed) context.newPending.set(committed.id, committed);
      return imported;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ImportRowError(duplicateMessage(error.meta?.target, row, error.meta?.modelName));
      }
      throw error;
    }
  }

  /**
   * In-app, plus email when the uploader has a real address. Never throws: by now the import
   * has happened (or failed) either way.
   */
  private async tellUploader(userId: string, title: string, message: string, summary?: ImportSummary): Promise<void> {
    try {
      await this.inapp.messageUser({ userId, title, message, callToActionUrl: ADMIN_LINKS.customers });
    } catch (error) {
      this.logger.error(`In-app import summary for ${userId} failed`, error instanceof Error ? error.stack : error);
      captureJobError(error, { queue: QueueName.services, job: 'import-summary' });
    }
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
      const email = visibleEmail(user?.email);
      if (!user || !email) return;
      if (summary) {
        await this.mail.sendCustomerImportSummary(email, {
          name: user.name,
          ...summary,
          errors: summary.errors.slice(0, SUMMARY_ERRORS),
          moreErrors: Math.max(0, summary.errors.length - SUMMARY_ERRORS),
          warnings: summary.warnings.slice(0, SUMMARY_ERRORS),
          moreWarnings: Math.max(0, summary.warnings.length - SUMMARY_ERRORS),
        });
      } else {
        await this.mail.sendCustomerNotification(email, { name: user.name, title, message });
      }
    } catch (error) {
      this.logger.error(`Import summary email for ${userId} failed`, error instanceof Error ? error.stack : error);
      captureJobError(error, { queue: QueueName.services, job: 'import-summary' });
    }
  }
}
