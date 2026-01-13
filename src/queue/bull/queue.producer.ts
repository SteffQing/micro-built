import {
  BadRequestException,
  Injectable,
  NotAcceptableException,
  OnModuleInit,
  PreconditionFailedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import * as XLSX from 'xlsx';
import { Queue } from 'bull';
import { QueueName } from 'src/common/types';
import {
  AddExistingCustomers,
  MaintenanceQueueName,
  RepaymentQueueName,
  ReportQueueName,
  ServicesQueueName,
} from 'src/common/types/queue.interface';
import {
  LiquidationResolution,
  ResolveRepayment,
} from 'src/common/types/repayment.interface';
import {
  ConsumerReport,
  GenerateMonthlyLoanSchedule,
} from 'src/common/types/report.interface';
import { HEADER_MAP, REQUIRED_SYSTEM_KEYS } from './service.utils';

@Injectable()
export class QueueProducer {
  constructor(
    @InjectQueue(QueueName.repayments) private repaymentQueue: Queue,
    @InjectQueue(QueueName.reports) private reportQueue: Queue,
    @InjectQueue(QueueName.services) private serviceQueue: Queue,
  ) {}
  async queueRepayments(docUrl: string, period: string) {
    await this.repaymentQueue.add(RepaymentQueueName.process_new_repayments, {
      url: docUrl,
      period,
    });
    return { data: null, message: 'Repayment has been queued for processing' };
  }

  async overflowRepayment(dto: ResolveRepayment) {
    await this.repaymentQueue.add(
      RepaymentQueueName.process_overflow_repayments,
      dto,
    );
  }

  async liquidationRequest(dto: LiquidationResolution) {
    await this.repaymentQueue.add(
      RepaymentQueueName.process_liquidation_request,
      dto,
    );
  }

  async generateReport(dto: GenerateMonthlyLoanSchedule) {
    await this.reportQueue.add(ReportQueueName.schedule_variation, dto);
  }

  async generateCustomerLoanReport(dto: ConsumerReport) {
    await this.reportQueue.add(ReportQueueName.customer_report, dto);
    return {
      data: null,
      message:
        'Customer loan report has been queued for processing and will be sent to the provided email',
    };
  }

  async addExistingCustomers(dto: AddExistingCustomers) {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(dto.file.buffer, {
        type: 'buffer',
        cellDates: true,
      });
    } catch (e) {
      throw new PreconditionFailedException('Invalid Excel file format');
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName)
      throw new PreconditionFailedException('Excel file has no sheets');
    const sheet = workbook.Sheets[sheetName];

    const rawData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    }) as any[][];

    if (rawData.length < 2) {
      throw new BadRequestException('Sheet contains no data rows');
    }

    // --- LOGIC CHANGE: Dynamic Header Discovery ---
    // We scan the first 20 rows. The first row that contains known keys is the header.
    let headerRowIndex = -1;
    const scanLimit = Math.min(rawData.length, 10);

    for (let i = 0; i < scanLimit; i++) {
      const row = rawData[i];
      if (!row || !Array.isArray(row)) continue;

      let matchCount = 0;
      row.forEach((cell) => {
        const val = String(cell).trim().toUpperCase();
        if (HEADER_MAP[val]) matchCount++;
      });

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

    const fileHeaders = rawData[headerRowIndex].map((h) =>
      String(h).trim().toUpperCase(),
    );

    const foundSystemKeys = new Set<string>();
    const columnIndexToKey: Record<number, string> = {};

    fileHeaders.forEach((header, index) => {
      const systemKey = HEADER_MAP[header];
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

    await this.serviceQueue.add(ServicesQueueName.onboard_existing_customers, {
      columnIndexToKey,
      rawData,
      headerRowIndex,
    });

    return {
      message: `File validated successfully. Processing records.`,
      data: null,
    };
  }
}

@Injectable()
export class MaintenanceProducer implements OnModuleInit {
  constructor(
    @InjectQueue(QueueName.maintenance) private maintenanceQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.maintenanceQueue.removeRepeatable(
      MaintenanceQueueName.supabase_ping,
      {
        cron: '0 0 */3 * *',
      },
    );

    await this.maintenanceQueue.add(
      MaintenanceQueueName.supabase_ping,
      {},
      {
        repeat: { cron: '0 0 */3 * *' },
        removeOnComplete: true,
        jobId: 'supabase-keep-alive',
      },
    );
  }
}
