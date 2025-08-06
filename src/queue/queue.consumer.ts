import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { UploadRepaymentQueueDto } from 'src/common/dto/queue.dto';
import { QueueName } from 'src/common/types';
import { RepaymentQueueName } from 'src/common/types/queue.interface';
import { RepaymentEntry } from 'src/common/types/repayment.interface';
import * as XLSX from 'xlsx';

@Processor(QueueName.repayments)
export class RepaymentsConsumer {
  private readonly logger = new Logger(RepaymentsConsumer.name);
  @Process(RepaymentQueueName.process_new_repayments)
  async handleTask(job: Job<UploadRepaymentQueueDto>) {
    const { url } = job.data;
    let progress = 0;

    try {
      this.logger.log(`Starting repayment processing for URL: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (rawData.length < 2) {
        throw new Error('Excel file appears to be empty or has no data rows');
      }

      // Get headers from first row
      const headers = rawData[0] as string[];
      this.logger.log(`Found headers: ${headers.join(', ')}`);

      const dataRows = rawData.slice(1) as any[][];
      const totalRows = dataRows.length;

      this.logger.log(`Processing ${totalRows} repayment entries`);

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];

        if (!row || row.every((cell) => !cell)) {
          continue;
        }

        try {
          const entry = this.mapRowToEntry(headers, row);
          await this.sendRepaymentNotification(entry, i + 1, totalRows);

          progress = Math.floor(((i + 1) / totalRows) * 100);
          await job.progress(progress);

          // Small delay to avoid overwhelming the notification service
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          this.logger.error(
            `Error processing row ${i + 1}: ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log(`Successfully processed ${totalRows} repayment entries`);
    } catch (error) {
      this.logger.error(
        `Failed to process repayments: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private mapRowToEntry(headers: string[], row: any[]) {
    const rowData: { [key: string]: any } = {};
    headers.forEach((header, index) => {
      rowData[header.toLowerCase().replace(/\s+/g, '')] = row[index];
    });

    return {
      staffId: String(rowData['staffid'] || ''),
      legacyId: String(rowData['legacyid'] || ''),
      fullName: String(rowData['fullname'] || ''),
      grade: String(rowData['grade'] || ''),
      step: String(rowData['step'] || ''),
      command: String(rowData['command'] || ''),
      element: String(rowData['element'] || ''),
      amount: parseFloat(rowData['amount']) || 0,
      employeeGross: parseFloat(rowData['employeegross']) || 0,
      netPay: parseFloat(rowData['netpay']) || 0,
      period: String(rowData['period'] || ''),
    };
  }

  private async sendRepaymentNotification(
    entry: RepaymentEntry,
    currentIndex: number,
    total: number,
  ) {
    const message = `
🏦 Repayment Entry ${currentIndex}/${total}

👤 Employee: ${entry.fullName}
🆔 Staff ID: ${entry.staffId}
🏛️ Command: ${entry.command}
📊 Grade: ${entry.grade} - Step: ${entry.step}
💰 Amount: ₦${entry.amount.toLocaleString()}
💵 Gross: ₦${entry.employeeGross.toLocaleString()}
💸 Net Pay: ₦${entry.netPay.toLocaleString()}
📅 Period: ${entry.period}
⚙️ Element: ${entry.element}

Progress: ${Math.floor((currentIndex / total) * 100)}%
    `.trim();

    await this.sendEmail(message);
  }

  async sendEmail(message: string) {
    await fetch('https://push.tg/r66373f', {
      method: 'POST',
      body: message,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

@Processor(QueueName.existing_users)
export class ExistingUsersConsumer {
  @Process()
  async handleTask(job: Job<unknown>) {
    // const { message, count } = job.data;
    let progress = 0;

    for (let i = 0; i < 1; i++) {
      // await this.sendEmail(message, i);

      progress++;

      await job.progress(progress);
    }
  }
}
