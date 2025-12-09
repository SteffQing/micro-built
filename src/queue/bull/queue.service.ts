import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { LoanStatus, LoanCategory, LoanType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { QueueName } from 'src/common/types';
import { PrismaService } from 'src/database/prisma.service';
import { generateCode, generateId, parseDateToPeriod } from 'src/common/utils';
import type {
  ExistingCustomerJob,
  ImportedCustomerRow,
} from 'src/common/types/services.queue.interface';
import { ConfigService } from 'src/config/config.service';
import { isNumericExcelValue, parseDate, parseDecimal } from './service.utils';
import { MailService } from 'src/notifications/mail.service';
import { ServicesQueueName } from 'src/common/types/queue.interface';

@Processor(QueueName.services)
export class ServicesConsumer {
  private readonly logger = new Logger(ServicesConsumer.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mail: MailService,
  ) {}

  @Process(ServicesQueueName.onboard_existing_customers)
  async handleImport(job: Job<ExistingCustomerJob>) {
    const { rawData, headerRowIndex, columnIndexToKey } = job.data;

    const customers: ImportedCustomerRow[] = rawData
      .slice(headerRowIndex + 1)
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

    this.logger.log(`Processing import for ${customers.length} records...`);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const [index, row] of customers.entries()) {
      try {
        await this.importSingleCustomer(row);
        results.success++;

        await job.progress(((index + 1) / customers.length) * 100);
      } catch (error) {
        results.failed++;
        const errorMsg = `Row ${index + 2} (${row.name || 'Unknown'}): ${error instanceof Error ? error.message : String(error)}`;
        this.logger.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    this.logger.log(
      `Import complete. Success: ${results.success}, Failed: ${results.failed}`,
    );

    if (results.errors.length > 0) {
      await this.mail.mailError(
        `Import Existing Consumers Error. Job ID: ${job.id}`,
        results.errors.join('\n\n'),
      );
    }

    return results;
  }

  private async importSingleCustomer(row: ImportedCustomerRow) {
    const isCashLoan = isNumericExcelValue(row.principal);
    const principal = isCashLoan ? parseDecimal(row.principal) : row.principal;

    const repayable = parseDecimal(row.totalRepayable);
    const repaid = parseDecimal(row.repaid);

    const password = generateCode.generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await this.prisma.user.findFirst({
      where: { name: { contains: row.marketerName, mode: 'insensitive' } },
      select: { id: true },
    });

    const datePeriod = parseDate(row.startDate) || new Date();

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: generateId.userId(),
          externalId: String(row.externalId),
          contact: String(row.contact),
          name: row.name,
          password: passwordHash,
          status: 'ACTIVE',
          accountOfficerId: admin?.id,
        },
        select: { id: true },
      });

      await tx.userPayroll.create({
        data: {
          userId: String(row.externalId),
          organization: row.organization,
          command: row.command,
        },
      });

      await tx.userPaymentMethod.create({
        data: {
          userId: user.id,
          bankName: row.bankName || 'Unknown Bank',
          accountNumber: String(row.accountNumber),
          accountName: row.name,
          bvn: String(row.bvn),
        },
      });

      const loanId = generateId.loanId();
      if (isCashLoan) {
        await tx.loan.create({
          data: {
            id: loanId,
            borrowerId: user.id,
            requestedById: admin?.id,

            principal,
            repaid,
            repayable,

            tenure: Number(row.tenure),
            interestRate: 0,
            managementFeeRate: 0,

            status: LoanStatus.DISBURSED,
            category: LoanCategory.PERSONAL,
            type: LoanType.New,

            disbursementDate: datePeriod,
            createdAt: datePeriod,
          },
        });
      } else {
        await tx.loan.create({
          data: {
            id: loanId,
            borrowerId: user.id,
            requestedById: admin?.id,

            principal: repayable,
            repaid,
            repayable,

            tenure: Number(row.tenure),
            interestRate: 0,
            managementFeeRate: 0,

            status: LoanStatus.DISBURSED,
            category: LoanCategory.ASSET_PURCHASE,
            type: LoanType.New,

            disbursementDate: parseDate(row.startDate) || new Date(),
            createdAt: parseDate(row.startDate) || new Date(),
          },
        });

        await tx.commodityLoan.create({
          data: {
            name: String(principal),
            id: generateId.assetLoanId(),
            borrowerId: user.id,
            createdAt: parseDate(row.startDate) || new Date(),
            inReview: false,
            requestedById: admin?.id,
            loanId,
          },
        });
      }

      await tx.repayment.create({
        data: {
          id: generateId.repaymentId(),
          amount: repaid,
          expectedAmount: repaid,
          repaidAmount: repaid,
          periodInDT: datePeriod,
          period: parseDateToPeriod(datePeriod),
          loanId,
          userId: user.id,
          status: 'FULFILLED',
        },
      });
    });

    if (!isCashLoan) {
      const commodities = await this.config.getValue('COMMODITY_CATEGORIES');
      const lowerCased = commodities?.map((c) => c.toLowerCase());
      if (!lowerCased?.includes(String(principal).toLowerCase())) {
        await this.config.addNewCommodityCategory(String(principal));
      }
    } else {
    }

    await Promise.all([this.config.topupValue('TOTAL_REPAID', repaid)]);
  }
}
