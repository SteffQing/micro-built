import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { Prisma, LoanStatus, LoanCategory, LoanType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { QueueName } from 'src/common/types';
import { PrismaService } from 'src/database/prisma.service';
import { generateId } from 'src/common/utils';

@Processor(QueueName.services)
export class ServicesConsumer {
  private readonly logger = new Logger(ServicesConsumer.name);

  constructor(private prisma: PrismaService) {}

  @Process('process-existing-customers')
  async handleImport(job: Job<{ adminId: string; customers: any[] }>) {
    const { adminId, customers } = job.data;
    this.logger.log(`Processing import for ${customers.length} records...`);

    const results = {
      success: 0,
      failed: 0,
    };

    for (const [index, row] of customers.entries()) {
      try {
        await this.importSingleCustomer(row, adminId);
        results.success++;

        await job.progress(((index + 1) / customers.length) * 100);
      } catch (error) {
        results.failed++;
        const errorMsg = `Row ${index + 2} (${row.name || 'Unknown'}): ${error.message}`;
        this.logger.error(errorMsg);
      }
    }

    this.logger.log(
      `Import complete. Success: ${results.success}, Failed: ${results.failed}`,
    );

    return results;
  }

  private async importSingleCustomer(row: any, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const principal = this.parseDecimal(row.principal);
      const totalRepayable = this.parseDecimal(row.totalRepayable);
      const repaid = this.parseDecimal(row.repaid);
      const outstanding = this.parseDecimal(row.outstanding); // Or calculate: total - repaid

      // 2. Create or Update User (Upsert based on IPPIS/ExternalID)
      const user = await tx.user.upsert({
        where: { externalId: String(row.externalId) },
        update: {
          // If user exists, do we update fields? Maybe just ensure active status
          status: 'ACTIVE',
        },
        create: {
          id: generateId.userId(), // Your ID generator logic
          externalId: String(row.externalId),
          email: row.email || null, // Optional in your sheet
          contact: String(row.contact),
          name: row.name,
          password: passwordHash,
          status: 'ACTIVE',
          role: 'CUSTOMER',
          accountOfficerId: adminId, // Assign to the uploader?
          repaymentRate: 100, // Default for imported existing users
        },
      });

      // 3. Upsert Payroll
      await tx.userPayroll.upsert({
        where: { userId: user.externalId }, // Schema uses externalId as PK for Payroll
        update: {
          organization: row.organization,
          command: row.command,
          netPay: 0, // Not in sheet, default to 0
        },
        create: {
          userId: user.externalId!, // Schema uses externalId as PK
          organization: row.organization,
          command: row.command,
          netPay: 0,
        },
      });

      // 4. Upsert Payment Method
      // We assume one account per user for import
      if (row.accountNumber) {
        await tx.userPaymentMethod.upsert({
          where: { accountNumber: String(row.accountNumber) },
          update: {}, // Don't overwrite if exists
          create: {
            userId: user.id,
            bankName: row.bankName || 'Unknown Bank',
            accountNumber: String(row.accountNumber),
            accountName: row.name, // Assume matches user name
            bvn: String(row.bvn) || `TEMP-${user.externalId}`, // Fallback if BVN missing
          },
        });
      }

      // 5. Create the "Existing" Loan
      // We typically create a new loan record representing this migrated debt
      const loanId = generateId.loanId();

      await tx.loan.create({
        data: {
          id: loanId,
          borrowerId: user.id,
          requestedById: adminId, // Admin imported it

          // Financials
          principal: principal,
          totalRepayable: totalRepayable,
          repaid: repaid,
          // Note: Prisma schema sets 'repaid' default 0, we override it here

          // Terms
          tenure: Number(row.tenure) || 0,
          interestRate: 0, // Historic data might not need recalc
          managementFeeRate: 0,

          // Meta
          status: LoanStatus.DISBURSED, // It's an active running loan
          category: LoanCategory.PERSONAL, // Default or map from sheet
          type: LoanType.New,

          // Dates
          disbursementDate: this.parseDate(row.startDate) || new Date(),
          createdAt: this.parseDate(row.startDate) || new Date(),
        },
      });
    });
  }

  private parseDecimal(value: any): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const clean = String(value).replace(/[^0-9.-]+/g, '');
    return parseFloat(clean) || 0;
  }

  private parseDate(value: any): Date | null {
    if (!value) return null;
    // Excel 'cellDates: true' might pass a JS Date object already
    if (value instanceof Date) return value;

    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
}
