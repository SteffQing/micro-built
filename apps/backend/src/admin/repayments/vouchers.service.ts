import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { parseYm, periodLabel, toYm, type Period } from '@microbuilt/shared';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  checkPayrollSheet,
  payrollUploadPath,
  PayrollSheetError,
  readPayrollSheet,
  type PayrollSheet,
  type PayrollSheetCheck,
} from 'src/common/logic/repayment-validation';
import {
  PAYROLL_UPLOADS_BUCKET,
  type EarlierUnlocked,
  type OrganizationRef,
  type VoucherIssueCounts,
  type VoucherReceipt,
  type VoucherReport,
} from 'src/common/types/repayment.interface';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { LedgerClock } from 'src/ledger/ledger.clock';
import { LedgerTx } from 'src/ledger/ledger.tx';
import { VariationLockService } from 'src/ledger/variation-lock.service';
import { QueueProducer } from 'src/queue/bull/queue.producer';
import { SettingsService } from 'src/settings/settings.service';
import { customersByStaffId, issueCounts, payableCustomers } from './voucher-rows';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ALREADY_UPLOADED = 'This file has already been uploaded';
const NO_ISSUES: VoucherIssueCounts = { unmatched: 0, otherOrganization: 0, notInVariation: 0 };

/** A reason the upload would be refused with a 409; the earlier-month one also names the months (P8). */
interface Conflict {
  message: string;
  earlier?: boolean;
}

/** A sheet read and checked, with what the database says about its organization, month and file. */
interface Inspection {
  sheet: PayrollSheet;
  check: PayrollSheetCheck;
  fileHash: string;
  organization: OrganizationRef;
  /** The organization's variation for the sheet's month, when it has been generated. */
  variation: { id: string; version: number; locked: boolean } | null;
  earlierUnlocked: EarlierUnlocked[];
  conflicts: Conflict[];
}

// An organization's voucher (its payroll return): checked against its variation, stored in the private bucket,
// recorded as a Voucher (which locks the variation), then turned into PaymentInflows row by row, and the variation
// settled, by the repayments queue (RepaymentsConsumer). Reverting one is the ledger's (VariationLockService).
@Injectable()
export class VouchersService {
  private readonly logger = new Logger(VouchersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly queue: QueueProducer,
    private readonly ledgerTx: LedgerTx,
    private readonly locks: VariationLockService,
    private readonly settings: SettingsService,
    private readonly clock: LedgerClock,
  ) {}

  /** Every check the upload runs, reported instead of refused; nothing is stored. */
  async validate(file: Express.Multer.File, organizationId: string, period?: string): Promise<VoucherReport> {
    const { sheet, check, organization, variation, earlierUnlocked, conflicts } = await this.inspect(
      file,
      organizationId,
      period,
    );
    const messages = conflicts.map((conflict) => conflict.message);
    const problems = [...check.problems, ...messages];

    let issues = NO_ISSUES;
    if (variation && !variation.locked && check.period && !check.missingColumns.length) {
      const [matches, payable] = await Promise.all([
        customersByStaffId(
          this.prisma,
          sheet.rows.map((row) => row.staffId).filter(Boolean),
        ),
        payableCustomers(this.prisma, variation.id),
      ]);
      issues = issueCounts(sheet.rows, matches, payable, organization.id);
    }
    return {
      valid: problems.length === 0,
      period: check.period ? periodLabel(check.period) : null,
      rows: check.rows,
      missingColumns: check.missingColumns,
      problems,
      invalidRows: check.invalidRows,
      organization,
      variation: variation ? { id: variation.id, version: variation.version } : null,
      issues,
      earlierUnlocked,
      conflicts: messages,
    };
  }

  /**
   * Stores a voucher and queues its rows. 400 for a sheet with problems (the first one is the message); 409 when the
   * organization has no variation for the month, it is locked, the same file was uploaded before, or an earlier
   * month of the organization is still unlocked (that 409 lists the months, so No payroll can be offered for them), or
   * no penalty rate is set yet.
   */
  async upload(
    file: Express.Multer.File,
    organizationId: string,
    adminId: string,
    period?: string,
  ): Promise<VoucherReceipt> {
    const { check, fileHash, organization, variation, earlierUnlocked, conflicts } = await this.inspect(
      file,
      organizationId,
      period,
    );
    if (check.problems.length) throw new BadRequestException(check.problems[0]);
    const [refusal] = conflicts;
    if (refusal) {
      throw refusal.earlier
        ? new ConflictException({ statusCode: 409, error: 'Conflict', message: refusal.message, earlierUnlocked })
        : new ConflictException(refusal.message);
    }
    // The voucher locks its variation and settling charges penalties: not without a rate to charge them at.
    await this.settings.requirePenaltyRate();
    // Both are set once the sheet has no problems and its variation is open.
    const month = check.period as Period;
    const target = variation as { id: string; version: number; locked: boolean };
    const label = periodLabel(month);
    const filename = file.originalname || `${toYm(month)}.xlsx`;

    await this.supabase.uploadPrivate(
      PAYROLL_UPLOADS_BUCKET,
      payrollUploadPath(month, fileHash),
      file.buffer,
      file.mimetype || XLSX_TYPE,
    );

    let voucherId: string;
    try {
      voucherId = await this.ledgerTx.transaction(async (tx) => {
        // Whoever locks, generates or reverts this variation waits for this, and the other way round.
        const [locked] = await tx.$queryRaw<{ noPayrollReason: string | null }[]>`
          SELECT "noPayrollReason" FROM "Variation" WHERE "id" = ${target.id} FOR UPDATE`;
        if (locked?.noPayrollReason != null) {
          throw new ConflictException(`${organization.name}'s ${label} variation was marked No payroll`);
        }
        const voucher = await tx.voucher.create({
          data: { variationId: target.id, fileHash, filename, uploadedById: adminId, createdAt: this.clock.now() },
          select: { id: true },
        });
        return voucher.id;
      });
    } catch (error) {
      // Another upload got in first: of the same file, or into the same variation.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          String(error.meta?.target).includes('variationId')
            ? `${organization.name}'s ${label} variation already has a voucher`
            : ALREADY_UPLOADED,
        );
      }
      throw error;
    }

    try {
      await this.queue.queueVoucher({ voucherId });
    } catch (error) {
      this.logger.error(`Queueing voucher ${voucherId} failed`, error instanceof Error ? error.stack : error);
      await this.forget(voucherId);
      throw new ServiceUnavailableException('The voucher could not be queued for processing. Upload the file again.');
    }
    return { voucherId, variationId: target.id, organization, period: label, rows: check.rows };
  }

  /** R6: the ledger undoes the voucher; then its stored sheet goes (best effort: the money is already right). */
  async revert(voucherId: string, reason: string, adminId: string) {
    const { stored, label, ...result } = await this.locks.revertVoucher(voucherId, reason, adminId);
    const path = payrollUploadPath(stored.period, stored.fileHash);
    await this.supabase.removePrivate(PAYROLL_UPLOADS_BUCKET, path).catch((error: unknown) => {
      this.logger.warn(`Removing ${path} (${label}) failed: ${error instanceof Error ? error.message : error}`);
    });
    return result;
  }

  private async inspect(file: Express.Multer.File, organizationId: string, requested?: string): Promise<Inspection> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    let sheet: PayrollSheet;
    let check: PayrollSheetCheck;
    try {
      sheet = readPayrollSheet(file.buffer);
      check = checkPayrollSheet(sheet, requested ? parseYm(requested) : undefined);
    } catch (error) {
      if (error instanceof PayrollSheetError) throw new BadRequestException(error.message);
      throw error;
    }

    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const conflicts: Conflict[] = [];
    let variation: Inspection['variation'] = null;
    let earlierUnlocked: EarlierUnlocked[] = [];
    if (check.period) {
      const month = check.period;
      const label = periodLabel(month);
      const { name } = organization;
      const row = await this.prisma.variation.findFirst({
        where: {
          organizationId,
          version: { gt: 0 },
          period: { year: month.year, month: month.month },
        },
        select: { id: true, version: true, noPayrollReason: true, voucher: { select: { id: true } } },
      });
      variation = row
        ? { id: row.id, version: row.version, locked: row.voucher !== null || row.noPayrollReason !== null }
        : null;

      const later = await this.locks.lockedAfter(organizationId, month);
      if (later) {
        conflicts.push({
          message: `${name}'s ${periodLabel(later)} variation is already locked, so ${label} can't take a voucher any more`,
        });
      } else if (!row) {
        conflicts.push({ message: `Generate ${name}'s ${label} variation first` });
      } else if (row.voucher) {
        conflicts.push({ message: `${name}'s ${label} variation already has a voucher` });
      } else if (row.noPayrollReason !== null) {
        conflicts.push({
          message: `${name}'s ${label} variation was marked No payroll: revert that before uploading its voucher`,
        });
      }
      earlierUnlocked = await this.locks.earlierUnlocked(organizationId, month);
    }
    if (await this.prisma.voucher.findUnique({ where: { fileHash }, select: { id: true } })) {
      conflicts.push({ message: ALREADY_UPLOADED });
    }
    if (earlierUnlocked.length) {
      const months = earlierUnlocked.map((earlier) => earlier.label).join(', ');
      const many = earlierUnlocked.length > 1;
      conflicts.push({
        message: `${organization.name} has no voucher yet for ${months}: upload ${many ? 'them' : 'it'}, or mark ${many ? 'them' : 'it'} No payroll, before this one`,
        earlier: true,
      });
    }
    return { sheet, check, fileHash, organization, variation, earlierUnlocked, conflicts };
  }

  /**
   * Undoes a voucher whose job could not be queued, so the same file can be uploaded again. No row of it has been
   * processed: the job never existed, and its audit entry is written by the job.
   */
  private async forget(voucherId: string): Promise<void> {
    try {
      await this.prisma.voucher.delete({ where: { id: voucherId } });
    } catch (error) {
      this.logger.error(`Removing unqueued voucher ${voucherId} failed`, error instanceof Error ? error.stack : error);
    }
  }
}
