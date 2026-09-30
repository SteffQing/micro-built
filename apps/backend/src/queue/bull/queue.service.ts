import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { LoanStatus, LoanCategory, LoanType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { QueueName } from 'src/common/types';
import { PrismaService } from 'src/database/prisma.service';
import { generateCode, generateId, parseDateToPeriod } from 'src/common/utils';
import type {
  AdminCache,
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

    const { knownCommodities, newCommoditiesToSave, adminCache } =
      await this.optimizations();

    let batchStats = {
      totalDisbursed: 0,
      totalRepaid: 0,
      totalOutstanding: 0,
    };

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const [index, row] of customers.entries()) {
      try {
        const stats = await this.importSingleCustomer(
          row,
          knownCommodities,
          newCommoditiesToSave,
          adminCache,
        );
        results.success++;

        batchStats.totalDisbursed += stats.disbursed;
        batchStats.totalRepaid += stats.repaid;
        batchStats.totalOutstanding += stats.outstanding;

        await job.progress(((index + 1) / customers.length) * 100);
      } catch (error) {
        results.failed++;
        const errorMsg = `Row ${index + 2} (${row.name || 'Unknown'}): ${error instanceof Error ? error.message : String(error)}`;
        this.logger.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    const updatePromises = [];

    if (results.success > 0) {
      updatePromises.push(
        this.config.topupValue('TOTAL_DISBURSED', batchStats.totalDisbursed),
      );
      updatePromises.push(
        this.config.topupValue('TOTAL_REPAID', batchStats.totalRepaid),
      );
      updatePromises.push(
        this.config.topupValue(
          'BALANCE_OUTSTANDING',
          batchStats.totalOutstanding,
        ),
      );
    }

    if (newCommoditiesToSave.size > 0) {
      updatePromises.push(
        this.config.addCommodities([...newCommoditiesToSave]),
      );
    }

    await Promise.all(updatePromises);

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

  private async importSingleCustomer(
    row: ImportedCustomerRow,
    knownCommodities: Set<string>,
    newCommoditiesToSave: Set<string>,
    adminCache: AdminCache[],
  ) {
    const isCashLoan = isNumericExcelValue(row.principal);
    const principal = isCashLoan ? parseDecimal(row.principal) : row.principal;

    const repayable = parseDecimal(row.totalRepayable);
    const repaid = parseDecimal(row.repaid);

    const outstanding = parseDecimal(row.outstanding);
    const disbursedAmount = isCashLoan ? (principal as number) : repayable;

    const password = generateCode.generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    const datePeriod = parseDate(row.startDate) || new Date();

    let adminId: string | undefined;
    if (row.marketerName) {
      const searchName = row.marketerName.toLowerCase().trim();
      const foundAdmin = adminCache.find((a) => a.name.includes(searchName));
      adminId = foundAdmin?.id;
    }

    if (!isCashLoan) {
      const assetName = String(principal).trim();
      const assetNameLower = assetName.toLowerCase();

      const existsInDB = knownCommodities.has(assetNameLower);
      const existsInNew = newCommoditiesToSave.has(assetNameLower);

      if (!existsInDB && !existsInNew) {
        newCommoditiesToSave.add(assetName);
        knownCommodities.add(assetNameLower);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: generateId.userId(),
          externalId: String(row.externalId),
          contact: String(row.contact),
          name: row.name,
          password: passwordHash,
          status: 'ACTIVE',
          accountOfficerId: adminId,
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

      await tx.loan.create({
        data: {
          id: loanId,
          borrowerId: user.id,
          requestedById: adminId,

          principal: disbursedAmount,
          repaid,
          repayable,

          tenure: Number(row.tenure),
          interestRate: 0,
          managementFeeRate: 0,

          status: LoanStatus.DISBURSED,
          category: isCashLoan
            ? LoanCategory.PERSONAL
            : LoanCategory.ASSET_PURCHASE,
          type: LoanType.New,

          disbursementDate: datePeriod,
          createdAt: datePeriod,
        },
      });

      if (!isCashLoan) {
        await tx.commodityLoan.create({
          data: {
            name: String(principal),
            id: generateId.assetLoanId(),
            borrowerId: user.id,
            createdAt: parseDate(row.startDate) || new Date(),
            inReview: false,
            requestedById: adminId,
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

    return {
      disbursed: disbursedAmount,
      repaid: repaid,
      outstanding: outstanding,
    };
  }

  private async optimizations() {
    const commodities =
      (await this.config.getValue('COMMODITY_CATEGORIES')) || [];
    const knownCommodities = new Set(commodities.map((c) => c.toLowerCase()));
    const newCommoditiesToSave = new Set<string>();

    const allAdmins = await this.prisma.user.findMany({
      where: { role: { not: 'CUSTOMER' } },
      select: { id: true, name: true },
    });

    const adminCache: AdminCache[] = allAdmins.map((a) => ({
      id: a.id,
      name: a.name.toLowerCase(),
    }));

    return { knownCommodities, newCommoditiesToSave, adminCache };
  }
}
