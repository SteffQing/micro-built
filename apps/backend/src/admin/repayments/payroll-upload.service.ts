import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
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
  type PayrollSheetCheck,
} from 'src/common/logic/repayment-validation';
import {
  PAYROLL_UPLOADS_BUCKET,
  type PayrollSheetReport,
  type PayrollUploadReceipt,
} from 'src/common/types/repayment.interface';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { LedgerTx } from 'src/ledger/ledger.tx';
import { QueueProducer } from 'src/queue/bull/queue.producer';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ALREADY_UPLOADED = 'This file has already been uploaded';

/** A sheet read and checked, with what the database says about its month and its file. */
interface Inspection {
  check: PayrollSheetCheck;
  fileHash: string;
  /** The PayrollPeriod row of the sheet's month, when it exists. */
  periodId: string | null;
  /** 409s: the month isn't open for payroll, or the file is already in. */
  conflicts: string[];
}

// Government payroll returns: checked, stored in the private bucket, recorded as a PayrollUpload,
// then turned into PaymentInflows row by row by the repayments queue (RepaymentsConsumer).
@Injectable()
export class PayrollUploadService {
  private readonly logger = new Logger(PayrollUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly queue: QueueProducer,
    private readonly ledgerTx: LedgerTx,
  ) {}

  /** Every check the upload runs, reported instead of refused; nothing is stored. */
  async validate(file: Express.Multer.File, period?: string): Promise<PayrollSheetReport> {
    const { check, conflicts } = await this.inspect(file, period);
    const problems = [...check.problems, ...conflicts];
    return {
      valid: problems.length === 0,
      period: check.period ? periodLabel(check.period) : null,
      rows: check.rows,
      missingColumns: check.missingColumns,
      problems,
      invalidRows: check.invalidRows,
    };
  }

  /**
   * Stores a payroll sheet and queues its rows. 400 for a sheet with problems (the first one is
   * the message), 409 when its month's variation hasn't been submitted, the month is closed, or
   * the same file was uploaded before.
   */
  async upload(file: Express.Multer.File, adminId: string, period?: string): Promise<PayrollUploadReceipt> {
    const { check, fileHash, periodId, conflicts } = await this.inspect(file, period);
    if (check.problems.length) throw new BadRequestException(check.problems[0]);
    if (conflicts.length) throw new ConflictException(conflicts[0]);
    // Both are set once the sheet has no problems and its month is open.
    const month = check.period as Period;
    const label = periodLabel(month);
    const filename = file.originalname || `${toYm(month)}.xlsx`;

    await this.supabase.uploadPrivate(
      PAYROLL_UPLOADS_BUCKET,
      payrollUploadPath(month, fileHash),
      file.buffer,
      file.mimetype || XLSX_TYPE,
    );

    let uploadId: string;
    try {
      uploadId = await this.ledgerTx.transaction(async (tx) => {
        const upload = await tx.payrollUpload.create({
          data: { periodId: periodId as string, fileHash, filename, uploadedById: adminId },
          select: { id: true },
        });
        await this.ledgerTx.audit(tx, {
          actorId: adminId,
          action: 'PAYROLL_UPLOADED',
          entityType: 'PAYROLL_UPLOAD',
          entityId: upload.id,
          note: `${label} payroll, ${check.rows} rows (${filename})`,
        });
        return upload.id;
      });
    } catch (error) {
      // Another upload of the same file got in first.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(ALREADY_UPLOADED);
      }
      throw error;
    }

    try {
      await this.queue.queuePayrollUpload({ uploadId });
    } catch (error) {
      this.logger.error(`Queueing payroll upload ${uploadId} failed`, error instanceof Error ? error.stack : error);
      await this.forget(uploadId);
      throw new ServiceUnavailableException('The payroll could not be queued for processing. Upload the file again.');
    }
    return { uploadId, period: label, rows: check.rows };
  }

  private async inspect(file: Express.Multer.File, requested?: string): Promise<Inspection> {
    let check: PayrollSheetCheck;
    try {
      check = checkPayrollSheet(readPayrollSheet(file.buffer), requested ? parseYm(requested) : undefined);
    } catch (error) {
      if (error instanceof PayrollSheetError) throw new BadRequestException(error.message);
      throw error;
    }

    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const conflicts: string[] = [];
    let periodId: string | null = null;
    if (check.period) {
      const { year, month } = check.period;
      const label = periodLabel(check.period);
      const row = await this.prisma.payrollPeriod.findUnique({
        where: { year_month: { year, month } },
        select: { id: true, variationSubmittedAt: true, closedAt: true },
      });
      periodId = row?.id ?? null;
      if (!row?.variationSubmittedAt) conflicts.push(`Submit the ${label} variation before uploading its payroll`);
      else if (row.closedAt) conflicts.push(`${label} is closed, so its payroll can no longer be uploaded`);
    }
    const existing = await this.prisma.payrollUpload.findUnique({ where: { fileHash }, select: { id: true } });
    if (existing) conflicts.push(ALREADY_UPLOADED);
    return { check, fileHash, periodId, conflicts };
  }

  /**
   * Undoes an upload whose job could not be queued, so the same file can be uploaded again. No
   * row of it has been processed: the job never existed.
   */
  private async forget(uploadId: string): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.auditLog.deleteMany({ where: { entityType: 'PAYROLL_UPLOAD', entityId: uploadId } }),
        this.prisma.payrollUpload.delete({ where: { id: uploadId } }),
      ]);
    } catch (error) {
      this.logger.error(`Removing unqueued payroll upload ${uploadId} failed`, error instanceof Error ? error.stack : error);
    }
  }
}
