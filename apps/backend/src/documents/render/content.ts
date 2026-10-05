import type { DocumentKind } from 'src/common/types/queue.interface';
import type { CustomerReportDto } from '../customer-report.dto';
import { lagosDate, lagosDateTime, lagosStamp } from '../spreadsheet';

// What a statement / report says, as titled sections of plain values. The PDF and the XLSX
// renderers lay out the same sections, so both files always agree.

/** A naira amount: a number the renderer formats (₦ and 2 decimals). */
export interface Naira {
  naira: number;
}
export type ReportValue = string | number | Naira;

export interface Field {
  label: string;
  value: ReportValue;
}

export interface Column {
  label: string;
  /** Relative width in the PDF. */
  weight: number;
  /** Only in the spreadsheet: the PDF page has no room for it. */
  xlsxOnly?: boolean;
}

export interface Table {
  title: string;
  columns: Column[];
  rows: ReportValue[][];
  /** Shown instead of an empty table. */
  empty: string;
}

const naira = (value: number): Naira => ({ naira: value });

export function isNaira(value: ReportValue): value is Naira {
  return typeof value === 'object';
}

/** ₦1,234,567.89 (−₦… when negative). `symbol` lets a PDF without the ₦ glyph write NGN instead. */
export function formatNaira(value: number, symbol = '₦'): string {
  const amount = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value < 0 ? '-' : ''}${symbol}${amount}`;
}

export function formatValue(value: ReportValue, symbol = '₦'): string {
  if (isNaira(value)) return formatNaira(value.naira, symbol);
  return String(value);
}

const humanize = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');

export function documentTitle(kind: DocumentKind): string {
  return kind === 'statement' ? 'Customer statement' : 'Customer loan report';
}

export function rangeLabel(data: CustomerReportDto): string {
  const { fromLabel, toLabel } = data.range;
  return fromLabel === toLabel ? fromLabel : `${fromLabel} – ${toLabel}`;
}

/** Identifies one generated file: the customer and the minute it was made, e.g. ST-MBE0320S-202610051257. */
export function statementReference(data: CustomerReportDto): string {
  return `ST-${data.customer.id.replace(/[^A-Za-z0-9]/g, '')}-${lagosStamp(data.generatedAt).slice(0, 12)}`;
}

/** What the browser saves the file as: NAME_CUSTOMERID_yyyyMMddHHmmss_statement.pdf, like a bank's. */
export function documentFileName(data: CustomerReportDto, kind: DocumentKind, format: string): string {
  const name = data.customer.name.replace(/[^A-Za-z0-9 .'-]+/g, '').trim().toUpperCase() || 'CUSTOMER';
  return `${name}_${data.customer.id}_${lagosStamp(data.generatedAt)}_${kind}.${format}`;
}

/** Who the statement is for, as the top-left block of a bank statement. */
export function customerBlock(data: CustomerReportDto): Field[] {
  const c = data.customer;
  const employer = [c.organization, c.command].filter(Boolean).join(' · ');
  return [
    { label: 'Customer ID', value: c.id },
    { label: 'IPPIS number', value: c.externalId ?? '' },
    { label: 'Employer', value: employer },
    ...(data.audience === 'admin' ? [{ label: 'Status', value: humanize(c.status) }] : []),
    { label: 'Phone', value: c.phoneNumber ?? '' },
    { label: 'Email', value: c.email ?? '' },
  ].filter((field) => field.value !== '');
}

/** What the statement covers: the top-right block. */
export function statementBlock(data: CustomerReportDto): Field[] {
  const loans = data.loans.map((loan) => loan.id).join(', ');
  return [
    { label: 'Period', value: rangeLabel(data) },
    { label: 'Reference', value: statementReference(data) },
    ...(loans ? [{ label: loans.includes(',') ? 'Loans' : 'Loan', value: loans }] : []),
    ...(data.accountOfficer !== undefined
      ? [{ label: 'Account officer', value: data.accountOfficer?.name ?? 'None' }]
      : []),
  ];
}

/** What a running loan takes each payroll month, and how much of the statement is debits and credits. */
export function statementFacts(data: CustomerReportDto): Field[] {
  const running = data.loans.filter((loan) => loan.status === 'DISBURSED');
  const monthly = running.reduce((sum, loan) => sum + (loan.monthly ?? 0), 0);
  const monthsLeft = running.reduce((most, loan) => Math.max(most, loan.remainingMonths), 0);
  const lines = data.statement.lines;
  return [
    { label: 'Monthly deduction', value: running.length ? naira(monthly) : 'No running loan' },
    { label: 'Months left', value: running.length ? String(monthsLeft) : '—' },
    { label: 'Debits', value: `${lines.filter((line) => line.debit > 0).length} entries` },
    { label: 'Credits', value: `${lines.filter((line) => line.credit > 0).length} entries` },
  ];
}

export function customerFields(data: CustomerReportDto): Field[] {
  const c = data.customer;
  const fields: Field[] = [
    { label: 'Name', value: c.name },
    { label: 'IPPIS number', value: c.externalId ?? '' },
    { label: 'Phone', value: c.phoneNumber ?? '' },
    { label: 'Email', value: c.email ?? '' },
    { label: 'Organization', value: c.organization ?? '' },
    { label: 'Command', value: c.command ?? '' },
    { label: 'Status', value: humanize(c.status) },
  ];
  if (data.accountOfficer !== undefined) {
    fields.push({ label: 'Account officer', value: data.accountOfficer?.name ?? 'None' });
  }
  return fields;
}

export function balanceFields(data: CustomerReportDto): Field[] {
  const s = data.statement;
  return [
    { label: 'Opening balance', value: naira(s.opening) },
    { label: 'Debits', value: naira(s.debits) },
    { label: 'Credits', value: naira(s.credits) },
    { label: 'Closing balance', value: naira(s.closing) },
  ];
}

export function totalFields(data: CustomerReportDto): Field[] {
  return [
    { label: 'Repaid in the period', value: naira(data.totals.repaid) },
    { label: 'Outstanding now', value: naira(data.totals.outstanding) },
    { label: 'Repayment rate', value: `${data.totals.repaymentRate}%` },
  ];
}

/** Admin only; empty for a customer's copy. */
export function revenueFields(data: CustomerReportDto): Field[] {
  const r = data.revenue;
  if (!r) return [];
  return [
    { label: 'Interest booked', value: naira(r.interestBooked) },
    { label: 'Interest collected', value: naira(r.interestCollected) },
    { label: 'Management fee', value: naira(r.managementFee) },
    { label: 'Penalty charged', value: naira(r.penaltyCharged) },
    { label: 'Penalty collected', value: naira(r.penaltyCollected) },
  ];
}

export function loansTable(data: CustomerReportDto): Table {
  const admin = data.audience === 'admin';
  return {
    title: 'Loans',
    empty: 'No loan was running in this period.',
    columns: [
      { label: 'Loan ID', weight: 1.1 },
      { label: 'Category', weight: 1 },
      { label: 'Status', weight: 0.9 },
      { label: 'Disbursed On', weight: 0.9 },
      { label: 'Commodity', weight: 1.1 },
      ...(admin ? [{ label: 'Private Details', weight: 1.2, xlsxOnly: true }] : []),
      { label: 'Principal', weight: 1 },
      { label: 'Interest Booked', weight: 1, xlsxOnly: true },
      { label: 'Penalty Booked', weight: 1, xlsxOnly: true },
      { label: 'Owed', weight: 1 },
      { label: 'Repaid', weight: 1 },
      { label: 'Outstanding', weight: 1 },
      { label: 'Monthly', weight: 1 },
      { label: 'Tenure (months)', weight: 0.6, xlsxOnly: true },
      { label: 'Months Left', weight: 0.6 },
    ],
    rows: data.loans.map((loan) => [
      loan.id,
      humanize(loan.category),
      humanize(loan.status),
      lagosDate(loan.disbursementDate),
      loan.commodity?.name ?? '',
      ...(admin ? [loan.commodity?.privateDetails ?? ''] : []),
      naira(loan.principal),
      naira(loan.interestBooked),
      naira(loan.penaltyBooked),
      naira(loan.owed),
      naira(loan.repaid),
      naira(loan.outstanding),
      loan.monthly === null ? '' : naira(loan.monthly),
      loan.tenure,
      loan.remainingMonths,
    ]),
  };
}

export function topupsTable(data: CustomerReportDto): Table {
  const admin = data.audience === 'admin';
  return {
    title: 'Top-ups',
    empty: 'No top-ups.',
    columns: [
      { label: 'Loan ID', weight: 1.1 },
      { label: 'Amount', weight: 1 },
      { label: 'Status', weight: 0.9 },
      { label: 'Requested On', weight: 0.9 },
      { label: 'Disbursed On', weight: 0.9 },
      { label: 'Commodity', weight: 1.2 },
      ...(admin ? [{ label: 'Private Details', weight: 1.5 }] : []),
    ],
    rows: data.loans.flatMap((loan) =>
      loan.topups.map((topup) => [
        loan.id,
        naira(topup.amount),
        humanize(topup.status),
        lagosDate(topup.requestedAt),
        lagosDate(topup.disbursedAt),
        topup.commodity?.name ?? '',
        ...(admin ? [topup.commodity?.privateDetails ?? ''] : []),
      ]),
    ),
  };
}

/** Admin only: the audit history (the flag reason is in `notesFields`). */
export function historyTable(data: CustomerReportDto): Table | null {
  if (!data.notes) return null;
  return {
    title: 'Internal notes',
    empty: 'No audit entries.',
    columns: [
      { label: 'Date', weight: 1 },
      { label: 'Action', weight: 1.5 },
      { label: 'By', weight: 1.2 },
      { label: 'Note', weight: 3 },
    ],
    rows: data.notes.history.map((entry) => [
      lagosDateTime(entry.createdAt),
      humanize(entry.action),
      entry.actorName,
      entry.note ?? '',
    ]),
  };
}

export function notesFields(data: CustomerReportDto): Field[] {
  if (!data.notes) return [];
  return [{ label: 'Flag reason', value: data.notes.flagReason ?? 'Not flagged' }];
}

export function statementTable(data: CustomerReportDto): Table {
  const admin = data.audience === 'admin';
  return {
    title: 'Statement',
    empty: 'Nothing was booked or paid in this period.',
    columns: [
      { label: 'Date', weight: 0.9 },
      { label: 'Loan ID', weight: 1.1 },
      { label: 'Reference', weight: 1.5, xlsxOnly: true },
      { label: 'Type', weight: 1, xlsxOnly: true },
      { label: 'Description', weight: 2.2 },
      { label: 'Debit', weight: 1 },
      { label: 'Credit', weight: 1 },
      { label: 'Balance', weight: 1 },
      ...(admin
        ? [
            { label: 'Management Fee', weight: 0.9 },
            { label: 'Principal Paid', weight: 0.9 },
            { label: 'Interest Paid', weight: 0.9 },
            { label: 'Penalty Paid', weight: 0.9 },
          ]
        : []),
    ],
    rows: data.statement.lines.map((line) => [
      lagosDate(line.date),
      line.loanId,
      line.reference,
      humanize(line.type),
      line.description,
      line.debit ? naira(line.debit) : '',
      line.credit ? naira(line.credit) : '',
      naira(line.balance),
      ...(admin
        ? [
            line.managementFee === undefined ? '' : naira(line.managementFee),
            line.split ? naira(line.split.principal) : '',
            line.split ? naira(line.split.interest) : '',
            line.split ? naira(line.split.penalty) : '',
          ]
        : []),
    ]),
  };
}

/** The table without its spreadsheet-only columns. */
export function forPdf(table: Table): Table {
  const keep = table.columns.map((column) => !column.xlsxOnly);
  return {
    ...table,
    columns: table.columns.filter((_, index) => keep[index]),
    rows: table.rows.map((row) => row.filter((_, index) => keep[index])),
  };
}
