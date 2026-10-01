import {
  BadRequestException,
  Injectable,
  Logger,
  NotAcceptableException,
  OnModuleInit,
  PreconditionFailedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import * as XLSX from 'xlsx';
import { CronRepeatOptions, Queue } from 'bull';
import { captureJobError } from 'src/common/observability';
import { QueueName } from 'src/common/types';
import {
  AddExistingCustomers,
  CustomerReportJob,
  MaintenanceQueueName,
  PayrollUploadJob,
  RepaymentQueueName,
  ReportQueueName,
  ServicesQueueName,
  VariationDraftJob,
} from 'src/common/types/queue.interface';
import { ExportListJob } from 'src/common/types/report.interface';
import type {
  ExistingCustomerJob,
  ImportKey,
} from 'src/common/types/services.queue.interface';
import { HEADER_MAP, REQUIRED_SYSTEM_KEYS } from './service.utils';

@Injectable()
export class QueueProducer {
  constructor(
    @InjectQueue(QueueName.repayments) private repaymentQueue: Queue,
    @InjectQueue(QueueName.reports) private reportQueue: Queue,
    @InjectQueue(QueueName.services) private serviceQueue: Queue,
  ) {}

  /** Once per upload: the job id makes a second enqueue of the same upload a no-op. */
  async queuePayrollUpload(job: PayrollUploadJob) {
    await this.repaymentQueue.add(RepaymentQueueName.process_payroll_upload, job, {
      jobId: `payroll-upload:${job.uploadId}`,
    });
  }

  async generateVariationDraft(job: VariationDraftJob) {
    await this.reportQueue.add(ReportQueueName.variation_draft, job);
  }

  async generateCustomerReport(job: CustomerReportJob) {
    await this.reportQueue.add(ReportQueueName.customer_report, job);
  }

  async exportList(dto: ExportListJob) {
    await this.reportQueue.add(ReportQueueName.export_list, dto);
    return {
      data: null,
      message:
        'Your export is being generated and will be emailed to you shortly',
    };
  }

  /**
   * Checks the existing-customer sheet's layout and queues it; the rows themselves are checked
   * and imported by ServicesConsumer, which sends the uploader a summary.
   */
  async addExistingCustomers(dto: AddExistingCustomers) {
    let workbook: XLSX.WorkBook;
    try {
      // Date cells stay Excel serials (calendar days, no time zone to shift them), and CSV text
      // is kept as typed, so "01/02/2026" isn't read as a US date.
      workbook = XLSX.read(dto.file.buffer, { type: 'buffer', raw: true });
    } catch {
      throw new PreconditionFailedException('Invalid Excel file format');
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName)
      throw new PreconditionFailedException('Excel file has no sheets');
    const sheet = workbook.Sheets[sheetName];

    // From row 1 whatever the first used row is, so rawData[i] is sheet row i + 1 and the
    // summary can name rows as the sheet numbers them.
    const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      range: 0,
    });

    // The header is the first row, within the first 20, naming at least three known columns.
    let headerRowIndex = -1;
    const scanLimit = Math.min(rawData.length, 20);

    for (let i = 0; i < scanLimit; i++) {
      const row = rawData[i];
      if (!Array.isArray(row)) continue;
      const matchCount = row.filter(
        (cell) => HEADER_MAP[String(cell).trim().toUpperCase()],
      ).length;
      if (matchCount >= 3) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new NotAcceptableException(
        'Could not detect a valid Header row in the first 20 lines. Ensure columns like IPPIS, NAME, and TOTAL exist.',
      );
    }

    const foundSystemKeys = new Set<ImportKey>();
    const columnIndexToKey: Record<number, ImportKey> = {};

    rawData[headerRowIndex].forEach((header, index) => {
      const systemKey = HEADER_MAP[String(header).trim().toUpperCase()];
      if (systemKey) {
        foundSystemKeys.add(systemKey);
        columnIndexToKey[index] = systemKey;
      }
    });

    const missingKeys = REQUIRED_SYSTEM_KEYS.filter(
      (k) => !foundSystemKeys.has(k),
    );

    if (missingKeys.length > 0) {
      const missingHeaders = missingKeys.map(
        (k) =>
          Object.keys(HEADER_MAP).find((key) => HEADER_MAP[key] === k) || k,
      );
      throw new BadRequestException(
        `Missing required columns: ${missingHeaders.join(', ')}. Please check your template.`,
      );
    }

    const hasDataRows = rawData
      .slice(headerRowIndex + 1)
      .some(
        (row) =>
          Array.isArray(row) && row.some((cell) => String(cell).trim() !== ''),
      );
    if (!hasDataRows) {
      throw new BadRequestException('Sheet contains no data rows');
    }

    await this.serviceQueue.add(ServicesQueueName.onboard_existing_customers, {
      columnIndexToKey,
      rawData,
      headerRowIndex,
      requestedById: dto.requestedById,
    } satisfies ExistingCustomerJob);

    return {
      message:
        'File validated. The customers are being imported; you will get a summary when it finishes.',
      data: null,
    };
  }

  async viewTasks() {
    const repaymentTasks = await this.repaymentQueue.getJobs([
      'active',
      'delayed',
      'waiting',
    ]);
    const reportTasks = await this.reportQueue.getJobs([
      'active',
      'delayed',
      'waiting',
    ]);
    const serviceTasks = await this.serviceQueue.getJobs([
      'active',
      'delayed',
      'waiting',
    ]);
    return { repaymentTasks, reportTasks, serviceTasks };
  }
}

/** The maintenance queue's repeating jobs (handled by MaintenanceService). */
const MAINTENANCE_SCHEDULES: {
  name: MaintenanceQueueName;
  jobId: string;
  repeat: CronRepeatOptions;
}[] = [
  // Every third day at midnight: Supabase pauses projects left idle.
  {
    name: MaintenanceQueueName.supabase_ping,
    jobId: 'supabase-keep-alive',
    repeat: { cron: '0 0 */3 * *' },
  },
  // 09:00 Lagos on the 25th: payroll needs the month's variation before it runs.
  {
    name: MaintenanceQueueName.variation_reminder,
    jobId: 'variation-reminder',
    repeat: { cron: '0 9 25 * *', tz: 'Africa/Lagos' },
  },
];

@Injectable()
export class MaintenanceProducer implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceProducer.name);

  constructor(
    @InjectQueue(QueueName.maintenance) private maintenanceQueue: Queue,
  ) {}

  /** A failure here is reported, not thrown: the API runs without its housekeeping. */
  async onModuleInit() {
    try {
      await this.schedule();
    } catch (error) {
      this.logger.error(
        'Scheduling maintenance jobs failed',
        error instanceof Error ? error.stack : String(error),
      );
      captureJobError(error, {
        queue: QueueName.maintenance,
        job: 'schedule',
      });
    }
  }

  /**
   * Every boot replaces the schedules, so one whose timing changed never keeps running the old
   * way. v1's month-end auto-report goes for good: in v2 a super admin submits the variation.
   */
  private async schedule() {
    const replaced = new Set<string>([
      ...MAINTENANCE_SCHEDULES.map((schedule) => schedule.name),
      MaintenanceQueueName.legacy_auto_report,
    ]);
    for (const job of await this.maintenanceQueue.getRepeatableJobs()) {
      if (replaced.has(job.name)) {
        await this.maintenanceQueue.removeRepeatableByKey(job.key);
      }
    }

    for (const { name, jobId, repeat } of MAINTENANCE_SCHEDULES) {
      await this.maintenanceQueue.add(
        name,
        {},
        { repeat, jobId, removeOnComplete: true, removeOnFail: true },
      );
    }
  }
}
