import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { periodLabel, visibleEmail } from '@microbuilt/shared';
import type { Prisma } from '@prisma/client';
import type { Job } from 'bull';
import { buildCustomerWhere } from 'src/admin/customers/customer-filters';
import { buildCashLoanWhere, buildCommodityLoanWhere } from 'src/admin/loan/loan-filters';
import { buildInflowWhere } from 'src/admin/repayments/repayment-filters';
import type { CustomersQueryDto } from 'src/admin/common/dto/customer.dto';
import type { CashLoanQueryDto, CommodityLoanQueryDto } from 'src/admin/common/dto/loan.dto';
import type { FilterRepaymentsDto } from 'src/admin/common/dto/repayment.dto';
import { loanFiguresMany, type LoanFiguresDto } from 'src/common/dto/loan.dto';
import { captureJobError } from 'src/common/observability';
import {
  QueueName,
  ReportQueueName,
  type CustomerReportJob,
  type DocumentFormat,
  type DocumentKind,
  type VariationDraftJob,
} from 'src/common/types/queue.interface';
import type { ExportDataset, ExportListJob } from 'src/common/types/report.interface';
import { chunkArray } from 'src/common/utils';
import { PrismaService } from 'src/database/prisma.service';
import { CustomerReportService } from 'src/documents/customer-report.service';
import type { CustomerReportDto } from 'src/documents/customer-report.dto';
import { DocumentsService } from 'src/documents/documents.service';
import { documentFileName, rangeLabel } from 'src/documents/render/content';
import { renderReportPdf, renderStatementPdf } from 'src/documents/render/pdf';
import { renderReportXlsx, renderStatementXlsx } from 'src/documents/render/xlsx';
import { lagosDate, lagosDay, rowsWorkbook, XLSX_MIME, type Cell } from 'src/documents/spreadsheet';
import { LedgerClock } from 'src/ledger/ledger.clock';
import { sum, toNumber } from 'src/ledger/money';
import { repaymentRates } from 'src/ledger/repayment-rate';
import { VariationService } from 'src/ledger/variation.service';
import { InappService } from 'src/notifications/inapp.service';
import { MailService } from 'src/notifications/mail.service';
import { protectDocument, shouldProtect } from 'src/documents/protect';

/** Safety ceiling: a no-filter export can't pull an unbounded result set. */
export const EXPORT_ROW_LIMIT = 100_000;
/** Ids per balance / rate query (each id is a bind parameter). */
const ID_CHUNK = 1000;

export const EXPORT_LABELS: Record<ExportDataset, string> = {
  customers: 'Customers',
  cash_loans: 'Cash loans',
  commodity_loans: 'Commodity loans',
  repayments: 'Repayments',
};

const COLUMNS = {
  customers: [
    'Customer ID',
    'Name',
    'Email',
    'Phone',
    'IPPIS ID',
    'Status',
    'Repayment Rate (%)',
    'Account Officer',
    'Organization',
    'Command',
    'Gross Pay',
    'Net Pay',
    'Signed Up',
  ],
  cash_loans: [
    'Loan ID',
    'Customer',
    'Customer ID',
    'IPPIS ID',
    'Category',
    'Status',
    'Principal',
    'Interest Rate (%)',
    'Management Fee Rate (%)',
    'Tenure (months)',
    'Remaining Months',
    'Interest Booked',
    'Penalty Booked',
    'Owed',
    'Repaid',
    'Outstanding',
    'Monthly Deduction',
    'Disbursed On',
    'Requested On',
  ],
  commodity_loans: [
    'Request ID',
    'Commodity',
    'Kind',
    'Status',
    'Amount',
    'Loan ID',
    'Loan Status',
    'Customer',
    'Customer ID',
    'IPPIS ID',
    'Details',
    'Private Details',
    'Requested On',
  ],
  repayments: [
    'Payment ID',
    'Payroll Month',
    'Source',
    'State',
    'Amount Received',
    'Applied to Loan',
    'Not Applied',
    'Loan ID',
    'Customer',
    'Customer ID',
    'IPPIS ID',
    'Upload ID',
    'Received On',
  ],
} as const satisfies Record<ExportDataset, readonly string[]>;

type Row = Record<string, Cell>;

export const PDF_MIME = 'application/pdf';

/** How each kind of customer document is rendered in each format. */
const RENDERERS: Record<DocumentKind, Record<DocumentFormat, (data: CustomerReportDto) => Buffer | Promise<Buffer>>> = {
  statement: { pdf: renderStatementPdf, xlsx: renderStatementXlsx },
  report: { pdf: renderReportPdf, xlsx: renderReportXlsx },
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const percent = (rate: Prisma.Decimal) => rate.times(100).toDecimalPlaces(2).toNumber();
const humanize = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');

/** `where` AND the customer's own records, so a customer's filters can never widen the scope. */
function scoped<W extends object>(where: W, scope: W | undefined): W {
  return scope ? ({ AND: [where, scope] } as W) : where;
}

// The reports queue (D11): list exports, customer reports and variation drafts. Every file goes
// to whoever asked as a 7-day link (DocumentsService.deliver), except the variation draft, which
// payroll staff receive as an attachment (MailService.sendLoanScheduleReport). Reads only: no
// money moves here.
@Processor(QueueName.reports)
export class GenerateReports {
  private readonly logger = new Logger(GenerateReports.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly customerReports: CustomerReportService,
    private readonly variations: VariationService,
    private readonly mail: MailService,
    private readonly inapp: InappService,
    private readonly clock: LedgerClock,
  ) {}

  // ---- List exports (admin lists, and a customer's own loans and repayments) ----

  @Process(ReportQueueName.export_list)
  async exportList(job: Job<ExportListJob>) {
    const { dataset, filters, requestedById, email, scopeUserId } = job.data;
    if (!requestedById) throw new Error('This export was queued before the upgrade; request it again');
    const label = EXPORT_LABELS[dataset];
    const rows = await this.exportRows(dataset, filters, scopeUserId);
    await job.progress(70);

    const body = rowsWorkbook(label, COLUMNS[dataset], rows);
    const fileName = `${dataset.replace(/_/g, '-')}-${lagosDay(this.clock.now())}.xlsx`;
    const count = rows.length === 1 ? '1 row' : `${rows.length} rows`;
    await this.documents.deliver({
      userId: requestedById,
      email,
      title: `${label} export ready`,
      message: `Your ${label.toLowerCase()} export (${count}) is ready to download. The link works for 7 days.`,
      fileName,
      contentType: XLSX_MIME,
      body,
    });
    await job.progress(100);
    return { dataset, rows: rows.length };
  }

  /** The rows of one export, filtered exactly as the list endpoint filters them. */
  async exportRows(dataset: ExportDataset, filters: Record<string, unknown>, scopeUserId?: string): Promise<Row[]> {
    switch (dataset) {
      case 'customers':
        return this.customerRows(
          scoped(
            await buildCustomerWhere(this.prisma, filters as unknown as CustomersQueryDto),
            scopeUserId ? { userId: scopeUserId } : undefined,
          ),
        );
      case 'cash_loans':
        return this.cashLoanRows(
          scoped(
            buildCashLoanWhere(filters as unknown as CashLoanQueryDto),
            scopeUserId ? { borrowerId: scopeUserId } : undefined,
          ),
        );
      case 'commodity_loans':
        return this.commodityRows(
          scoped(
            buildCommodityLoanWhere(filters as unknown as CommodityLoanQueryDto),
            scopeUserId ? { loan: { borrowerId: scopeUserId } } : undefined,
          ),
        );
      case 'repayments':
        return this.inflowRows(
          scoped(
            buildInflowWhere(filters as unknown as FilterRepaymentsDto),
            scopeUserId ? { customerId: scopeUserId } : undefined,
          ),
        );
      default: {
        const unknown: never = dataset;
        throw new Error(`Unsupported export dataset: ${String(unknown)}`);
      }
    }
  }

  private async customerRows(where: Prisma.CustomerWhereInput): Promise<Row[]> {
    const customers = await this.prisma.customer.findMany({
      where,
      take: EXPORT_ROW_LIMIT,
      orderBy: { user: { name: 'asc' } },
      select: {
        userId: true,
        externalId: true,
        user: { select: { name: true, email: true, phoneNumber: true, status: true, createdAt: true } },
        accountOfficer: { select: { user: { select: { name: true } } } },
        payroll: { select: { organization: { select: { name: true } }, command: true, employeeGross: true, netPay: true } },
      },
    });
    const rates = new Map<string, number>();
    for (const ids of chunkArray(
      customers.map((c) => c.userId),
      ID_CHUNK,
    )) {
      for (const [id, rate] of await repaymentRates(this.prisma, ids)) rates.set(id, rate);
    }
    return customers.map((c) => ({
      'Customer ID': c.userId,
      Name: c.user.name,
      Email: visibleEmail(c.user.email) ?? '',
      Phone: c.user.phoneNumber ?? '',
      'IPPIS ID': c.externalId ?? '',
      Status: c.user.status,
      'Repayment Rate (%)': rates.get(c.userId) ?? 100,
      'Account Officer': c.accountOfficer?.user.name ?? '',
      Organization: c.payroll?.organization.name ?? '',
      Command: c.payroll?.command ?? '',
      'Gross Pay': c.payroll ? toNumber(c.payroll.employeeGross) : '',
      'Net Pay': c.payroll ? toNumber(c.payroll.netPay) : '',
      'Signed Up': lagosDate(c.user.createdAt),
    }));
  }

  private async cashLoanRows(where: Prisma.LoanWhereInput): Promise<Row[]> {
    const loans = await this.prisma.loan.findMany({
      where,
      take: EXPORT_ROW_LIMIT,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        category: true,
        principal: true,
        tenure: true,
        interestRate: true,
        managementFeeRate: true,
        disbursementDate: true,
        createdAt: true,
        borrowerId: true,
        borrower: { select: { externalId: true, user: { select: { name: true } } } },
      },
    });
    const figures = new Map<string, LoanFiguresDto>();
    for (const chunk of chunkArray(loans, ID_CHUNK)) {
      for (const [id, f] of await loanFiguresMany(this.prisma, chunk)) figures.set(id, f);
    }
    return loans.map((loan) => {
      const f = figures.get(loan.id);
      return {
        'Loan ID': loan.id,
        Customer: loan.borrower.user.name,
        'Customer ID': loan.borrowerId,
        'IPPIS ID': loan.borrower.externalId ?? '',
        Category: humanize(loan.category),
        Status: loan.status,
        Principal: f?.principal ?? toNumber(loan.principal),
        'Interest Rate (%)': percent(loan.interestRate),
        'Management Fee Rate (%)': percent(loan.managementFeeRate),
        'Tenure (months)': loan.tenure,
        'Remaining Months': f?.remainingMonths ?? loan.tenure,
        'Interest Booked': f?.interestBooked ?? 0,
        'Penalty Booked': f?.penaltyBooked ?? 0,
        Owed: f?.owed ?? 0,
        Repaid: f?.repaid ?? 0,
        Outstanding: f?.outstanding ?? 0,
        'Monthly Deduction': f?.monthly ?? '',
        'Disbursed On': lagosDate(loan.disbursementDate),
        'Requested On': lagosDate(loan.createdAt),
      };
    });
  }

  private async commodityRows(where: Prisma.CommodityLoanWhereInput): Promise<Row[]> {
    const requests = await this.prisma.commodityLoan.findMany({
      where,
      take: EXPORT_ROW_LIMIT,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        loanId: true,
        publicDetails: true,
        privateDetails: true,
        createdAt: true,
        commodity: { select: { name: true } },
        microLoan: { select: { amount: true, purpose: true } },
        loan: {
          select: {
            status: true,
            borrowerId: true,
            borrower: { select: { externalId: true, user: { select: { name: true } } } },
          },
        },
      },
    });
    return requests.map((r) => ({
      'Request ID': r.id,
      Commodity: r.commodity.name,
      // A top-up's microloan is linked when it's requested; a new loan's when it's disbursed.
      Kind: r.microLoan?.purpose === 'TOPUP' ? 'Top-up' : 'New loan',
      Status: r.status,
      Amount: r.microLoan ? toNumber(r.microLoan.amount) : '',
      'Loan ID': r.loanId,
      'Loan Status': r.loan.status,
      Customer: r.loan.borrower.user.name,
      'Customer ID': r.loan.borrowerId,
      'IPPIS ID': r.loan.borrower.externalId ?? '',
      Details: r.publicDetails ?? '',
      'Private Details': r.privateDetails ?? '',
      'Requested On': lagosDate(r.createdAt),
    }));
  }

  private async inflowRows(where: Prisma.PaymentInflowWhereInput): Promise<Row[]> {
    const inflows = await this.prisma.paymentInflow.findMany({
      where,
      take: EXPORT_ROW_LIMIT,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        source: true,
        state: true,
        amount: true,
        customerId: true,
        externalUserId: true,
        voucherId: true,
        createdAt: true,
        period: { select: { year: true, month: true } },
        customer: { select: { externalId: true, user: { select: { name: true } } } },
        repayment: { select: { loanId: true, amount: true } },
      },
    });
    return inflows.map((i) => {
      const applied = i.repayment ? toNumber(i.repayment.amount) : 0;
      return {
        'Payment ID': i.id,
        'Payroll Month': periodLabel(i.period),
        Source: i.source,
        State: i.state,
        'Amount Received': toNumber(i.amount),
        'Applied to Loan': applied,
        'Not Applied': toNumber(i.amount.minus(applied)),
        'Loan ID': i.repayment?.loanId ?? '',
        Customer: i.customer?.user.name ?? '',
        'Customer ID': i.customerId ?? '',
        // An unmatched payroll row has no customer, only the sheet's staff ID.
        'IPPIS ID': i.customer?.externalId ?? i.externalUserId ?? '',
        'Upload ID': i.voucherId ?? '',
        'Received On': lagosDate(i.createdAt),
      };
    });
  }

  // ---- Customer statement / report (Stage 6: PDF or XLSX) ----

  @Process(ReportQueueName.customer_report)
  async customerReport(job: Job<CustomerReportJob>) {
    const { customerId, email, requestedById, audience } = job.data;
    // Jobs queued before Stage 6 carry neither: they were statement spreadsheets.
    const kind = job.data.kind ?? 'statement';
    const format = job.data.format ?? 'xlsx';
    const data = await this.customerReports.build(customerId, audience, { from: job.data.from, to: job.data.to });
    await job.progress(60);

    const rendered = await RENDERERS[kind][format](data);
    const protect = shouldProtect(audience, job.data.protect);
    const body = protect ? await protectDocument(rendered, format, customerId) : rendered;
    const name = data.customer.name;
    const what = kind === 'statement' ? 'statement' : 'loan report';
    const range = rangeLabel(data);
    // The customer's own request carries their id as the requester.
    const forCustomer = !requestedById || requestedById === customerId;
    // The password is never written in the message: it goes by email, and the file may be forwarded.
    const password = forCustomer
      ? ' The file is password-protected: open it with your customer ID (it starts with MB- and is on your profile).'
      : ` The file is password-protected: it opens with ${name}'s customer ID.`;
    await this.documents.deliver({
      userId: requestedById ?? customerId,
      email,
      title: forCustomer ? `Your ${what} is ready` : `${capitalize(what)} for ${name} is ready`,
      message:
        `${forCustomer ? 'Your' : `${name}'s`} ${what} for ${range} is ready to download. The link works for 7 days.` +
        (protect ? password : ''),
      fileName: documentFileName(data, kind, format),
      contentType: format === 'pdf' ? PDF_MIME : XLSX_MIME,
      body,
    });
    await job.progress(100);
    return { customerId, kind, format, lines: data.statement.lines.length };
  }

  // ---- Variation draft (emailed to payroll staff; submitting is not a job) ----

  @Process(ReportQueueName.variation_draft)
  async variationDraft(job: Job<VariationDraftJob>) {
    const { periodId, email } = job.data;
    const preview = await this.variations.preview(periodId);
    await job.progress(50);
    const file = this.variations.buildWorkbook(preview.rows);
    await this.mail.sendLoanScheduleReport(
      email,
      {
        period: preview.period.label,
        len: preview.rows.length,
        amount: toNumber(sum(preview.rows.map((row) => row.amount))),
        draft: true,
      },
      file,
    );
    await job.progress(100);
    return { period: preview.period.label, rows: preview.rows.length };
  }

  // ---- Failures ----

  @OnQueueFailed()
  async onFailed(job: Job<Partial<ExportListJob & CustomerReportJob & VariationDraftJob>>, error: Error) {
    this.logger.error(`${job.name} (${job.id}) failed: ${error.message}`, error.stack);
    captureJobError(error, { queue: QueueName.reports, job: job.name, jobId: job.id });
    // Only once the last attempt has failed.
    if (job.attemptsMade < (job.opts?.attempts ?? 1)) return;

    const what = this.describe(job);
    if (!what) return;
    try {
      await this.inapp.messageUser({
        userId: what.userId,
        title: `Your ${what.file} couldn't be made`,
        message: `Something went wrong while making your ${what.file}. Please request it again; if it keeps failing, contact support.`,
      });
    } catch (notifyError) {
      this.logger.error(
        `Telling ${what.userId} that ${job.name} (${job.id}) failed did not work`,
        notifyError instanceof Error ? notifyError.stack : String(notifyError),
      );
      captureJobError(notifyError, { queue: QueueName.reports, job: `${job.name}:notify-failure`, jobId: job.id });
    }
  }

  /** Who asked for a failed job's file, and what to call it. */
  private describe(job: Job<Partial<ExportListJob & CustomerReportJob & VariationDraftJob>>) {
    const data = job.data ?? {};
    switch (job.name as ReportQueueName) {
      case ReportQueueName.export_list: {
        const label = data.dataset ? EXPORT_LABELS[data.dataset] : undefined;
        return data.requestedById
          ? { userId: data.requestedById, file: label ? `${label.toLowerCase()} export` : 'export' }
          : null;
      }
      case ReportQueueName.customer_report: {
        const userId = data.requestedById ?? data.customerId;
        return userId ? { userId, file: data.kind === 'statement' ? 'statement' : 'loan report' } : null;
      }
      case ReportQueueName.variation_draft:
        return data.requestedById ? { userId: data.requestedById, file: 'variation draft' } : null;
      default:
        return null;
    }
  }
}
