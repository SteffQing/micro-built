import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import * as XLSX from 'xlsx';
import { Queue } from 'bull';
import { QueueName } from 'src/common/types';
import {
  AddExistingCustomers,
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
import { HEADER_MAP, REQUIRED_SYSTEM_KEYS } from './utils';

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
      throw new BadRequestException('Invalid Excel file format');
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException('Excel file has no sheets');
    const sheet = workbook.Sheets[sheetName];

    const rawData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    }) as any[][];

    if (rawData.length < 2) {
      throw new BadRequestException('Sheet contains no data rows');
    }

    const fileHeaders = rawData[0].map((h) => String(h).trim().toUpperCase());

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

    const cleanPayload = rawData
      .slice(1)
      .map((row) => {
        if (row.length === 0 || row.every((cell) => !cell)) return null;
        const record: any = {};

        Object.keys(columnIndexToKey).forEach((colIndexStr) => {
          const colIndex = Number(colIndexStr);
          const key = columnIndexToKey[colIndex];
          let value = row[colIndex];

          if (typeof value === 'string') value = value.trim();
          record[key] = value;
        });

        if (!record.externalId) return null;
        return record;
      })
      .filter((r) => r !== null);

    if (cleanPayload.length === 0) {
      throw new BadRequestException(
        'No valid data rows found (Check IPPIS column)',
      );
    }

    await this.serviceQueue.add(ServicesQueueName.onboard_existing_customers, {
      customers: cleanPayload,
    });

    return {
      message: `File validated successfully. Processing ${cleanPayload.length} records.`,
      data: null,
    };
  }
}
