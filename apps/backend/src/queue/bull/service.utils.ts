import { normalizeNgPhone } from '@microbuilt/shared';
import type {
  ExistingCustomerJob,
  ImportedCustomerRow,
  ImportKey,
  ImportSummary,
} from 'src/common/types/services.queue.interface';
import { formatCurrency } from 'src/common/utils';
import type { ImportLoan } from 'src/ledger/ledger.service';
import { max, money, toNumber, ZERO, type Money } from 'src/ledger/money';

// The existing-customer sheet: which header fills which field, how a row is checked, and how it
// becomes the running loan LedgerService.importLoan brings onto the ledger. Pure, so it is tested
// without a database.

/** Header (trimmed, upper case) → field. Several spellings map to one field. */
const HEADER_MAP: Record<string, ImportKey> = {
  IPPIS: 'externalId',
  NAME: 'name',
  ORGANIZATION: 'organization',
  ORGANISATION: 'organization',
  COMMAND: 'command',
  MARKETER: 'marketerName',
  'AMOUNT/ITEM': 'principal',
  TOTAL: 'totalRepayable',
  'AMOUNT PAID': 'repaid',
  'OUTSTANDING BALANCE': 'outstanding',
  'MONTHLY DEDUCTION': 'monthlyDeduction',
  'START DATE': 'startDate',
  'END DATE': 'endDate',
  'BANK NAME': 'bankName',
  BVN: 'bvn',
  'PHONE NUMBER': 'contact',

  TENURE: 'tenure',
  TENOR: 'tenure', // Maps alias to same key
  'ACC. NUMBER': 'accountNumber',
  'ACCOUNT NUMBER': 'accountNumber',
  PHONE: 'contact',
};

/** Columns a sheet must have. The phone is how an imported customer signs in (SMS codes). */
const REQUIRED_SYSTEM_KEYS: ImportKey[] = [
  'externalId',
  'name',
  'accountNumber',
  'bvn',
  'principal',
  'totalRepayable',
  'outstanding',
  'tenure',
  'startDate',
  'command',
  'organization',
  'contact',
];

export { REQUIRED_SYSTEM_KEYS, HEADER_MAP };

const DAY_MS = 24 * 60 * 60 * 1000;
// Excel date serials count days from 1899-12-30.
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const EARLIEST_START_YEAR = 2000;

/** A cell as trimmed text ('' when empty). */
export function cellText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

/** "₦1,250,000.50", "N1250000.5" or 1250000.5 → 1250000.50; null when empty or not an amount. */
export function parseAmount(value: unknown): Money | null {
  if (typeof value === 'number') return Number.isFinite(value) ? money(value) : null;
  const clean = cellText(value)
    .replace(/^(₦|NGN|N)\s*/i, '')
    .replace(/[,\s]/g, '');
  return /^-?\d+(\.\d+)?$/.test(clean) ? money(clean) : null;
}

/** The first number in a phone cell ("0803… / 0805…" holds two), as +234…; null if it isn't a Nigerian mobile. */
export function parsePhone(value: unknown): string | null {
  const first = cellText(value).split(/[,;/|]|\s+or\s+/i)[0]?.trim() ?? '';
  return first ? normalizeNgPhone(first) : null;
}

/** Midnight UTC of a calendar day; null for one that doesn't exist (31/02). */
function calendarDay(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  const exists = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return exists ? date : null;
}

/**
 * A sheet date as midnight UTC of its calendar day. Date cells arrive as Excel serials (calendar
 * days, no time zone); typed dates as DD/MM/YYYY (the Nigerian order) or YYYY-MM-DD. Jobs queued
 * when the sheet was read with JS dates carry ISO instants at about local midnight: the nearest
 * UTC midnight is their day.
 */
export function parseSheetDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(Math.round(value.getTime() / DAY_MS) * DAY_MS);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 1 ? new Date(EXCEL_EPOCH_MS + Math.floor(value) * DAY_MS) : null;
  }
  const raw = cellText(value);
  if (/^\d+(\.\d+)?$/.test(raw)) return parseSheetDate(Number(raw));
  let match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(raw);
  if (match) return calendarDay(Number(match[3]), Number(match[2]), Number(match[1]));
  match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) return calendarDay(Number(match[1]), Number(match[2]), Number(match[3]));
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return parseSheetDate(new Date(raw));
  return null;
}

/** dd/MM/yyyy, as the variation file writes dates. */
export function dmy(day: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(day.getUTCDate())}/${pad(day.getUTCMonth() + 1)}/${day.getUTCFullYear()}`;
}

/** Today on the Lagos calendar, in parseSheetDate's form. */
export function lagosToday(now: Date): Date {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS);
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()));
}

const naira = (value: Money) => formatCurrency(toNumber(value));
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

export interface SheetRow {
  /** As the sheet numbers it. */
  rowNumber: number;
  record: ImportedCustomerRow;
}

/** The rows under the header: blank lines dropped; rows without an IPPIS number (totals, notes) only counted. */
export function sheetRows(job: Pick<ExistingCustomerJob, 'rawData' | 'headerRowIndex' | 'columnIndexToKey'>): {
  rows: SheetRow[];
  skipped: number;
} {
  const rows: SheetRow[] = [];
  let skipped = 0;
  job.rawData.forEach((cells, index) => {
    if (index <= job.headerRowIndex || !Array.isArray(cells) || cells.every((cell) => !cellText(cell))) return;
    const record: ImportedCustomerRow = {};
    for (const [column, key] of Object.entries(job.columnIndexToKey)) record[key] = cells[Number(column)];
    if (cellText(record.externalId)) rows.push({ rowNumber: index + 1, record });
    else skipped++;
  });
  return { rows, skipped };
}

/** A row checked and normalised. */
export interface ImportRow {
  externalId: string;
  name: string;
  /** +234…: the customer signs in with SMS codes. */
  phoneNumber: string;
  accountNumber: string;
  bvn: string;
  bankName: string;
  organization: string;
  command: string;
  marketerName: string | null;
  /** Cash handed over; null on an asset row. */
  cashPrincipal: Money | null;
  /** What was bought (the AMOUNT/ITEM column holds a name); null on a cash row. */
  assetName: string | null;
  totalRepayable: Money;
  repaid: Money;
  /** Months, as originally agreed. */
  tenure: number;
  startDate: Date;
  endDate: Date | null;
}

/** Something the sheet must fix; the message goes to the uploader as it is. */
export class ImportRowError extends Error {}

/** Checks a row against what an account and a ledger loan need; throws ImportRowError naming the cell. */
export function parseImportRow(record: ImportedCustomerRow, today: Date): ImportRow {
  const required = (key: ImportKey, header: string): string => {
    const value = cellText(record[key]);
    if (!value) throw new ImportRowError(`${header} is empty`);
    return value;
  };
  const amount = (key: ImportKey, header: string): Money => {
    const raw = required(key, header);
    const value = parseAmount(record[key]);
    if (!value || value.lt(0)) throw new ImportRowError(`${header} "${raw}" is not an amount`);
    return value;
  };
  const day = (key: ImportKey, header: string, raw: string): Date => {
    const value = parseSheetDate(record[key]);
    if (!value) throw new ImportRowError(`${header} "${raw}" is not a date (use DD/MM/YYYY)`);
    return value;
  };

  const externalId = required('externalId', 'IPPIS');
  const name = required('name', 'NAME');
  const organization = required('organization', 'ORGANIZATION');
  const command = required('command', 'COMMAND');

  const contact = required('contact', 'PHONE NUMBER');
  const phoneNumber = parsePhone(contact);
  if (!phoneNumber) throw new ImportRowError(`PHONE NUMBER "${contact}" is not a Nigerian mobile number`);

  const accountCell = required('accountNumber', 'ACCOUNT NUMBER');
  // A number cell has lost the account number's leading zeros.
  const accountNumber =
    typeof record.accountNumber === 'number' ? accountCell.padStart(10, '0') : accountCell.replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(accountNumber)) {
    throw new ImportRowError(`ACCOUNT NUMBER "${accountCell}" is not a 10-digit account number`);
  }
  const bvnCell = required('bvn', 'BVN');
  const bvn = bvnCell.replace(/[\s-]/g, '');
  if (!/^\d{11}$/.test(bvn)) throw new ImportRowError(`BVN "${bvnCell}" is not an 11-digit BVN`);

  const totalRepayable = amount('totalRepayable', 'TOTAL');
  if (totalRepayable.isZero()) throw new ImportRowError('TOTAL must be more than zero');
  const item = required('principal', 'AMOUNT/ITEM');
  const cashPrincipal = parseAmount(record.principal);
  if (cashPrincipal && cashPrincipal.lte(0)) throw new ImportRowError('AMOUNT/ITEM must be more than zero');
  if (cashPrincipal && cashPrincipal.gt(totalRepayable)) {
    throw new ImportRowError(`TOTAL (${naira(totalRepayable)}) is less than AMOUNT/ITEM (${naira(cashPrincipal)})`);
  }
  if (!cashPrincipal && !/[a-z]/i.test(item)) {
    throw new ImportRowError(`AMOUNT/ITEM "${item}" is neither an amount nor an asset name`);
  }

  // AMOUNT PAID when the row has it, else what TOTAL and OUTSTANDING BALANCE leave.
  let repaid = ZERO;
  if (cellText(record.repaid)) repaid = amount('repaid', 'AMOUNT PAID');
  else if (cellText(record.outstanding)) {
    repaid = max(ZERO, totalRepayable.minus(amount('outstanding', 'OUTSTANDING BALANCE')));
  }
  if (repaid.gt(totalRepayable)) {
    throw new ImportRowError(`AMOUNT PAID (${naira(repaid)}) is more than TOTAL (${naira(totalRepayable)})`);
  }

  const tenureCell = required('tenure', 'TENURE');
  const tenureMatch = /^(\d+)(\s*months?)?$/i.exec(tenureCell);
  const tenure = tenureMatch ? Number(tenureMatch[1]) : 0;
  if (tenure < 1) throw new ImportRowError(`TENURE "${tenureCell}" is not a number of months`);

  const startDate = day('startDate', 'START DATE', required('startDate', 'START DATE'));
  if (startDate > today) throw new ImportRowError(`START DATE ${dmy(startDate)} is in the future`);
  if (startDate.getUTCFullYear() < EARLIEST_START_YEAR) {
    throw new ImportRowError(`START DATE ${dmy(startDate)} is before ${EARLIEST_START_YEAR}`);
  }
  const endCell = cellText(record.endDate);
  const endDate = endCell ? day('endDate', 'END DATE', endCell) : null;
  if (endDate && endDate < startDate) {
    throw new ImportRowError(`END DATE ${dmy(endDate)} is before START DATE ${dmy(startDate)}`);
  }

  return {
    externalId,
    name,
    phoneNumber,
    accountNumber,
    bvn,
    bankName: cellText(record.bankName) || 'Unknown Bank',
    organization,
    command,
    marketerName: cellText(record.marketerName) || null,
    cashPrincipal,
    assetName: cashPrincipal ? null : item,
    totalRepayable,
    repaid,
    tenure,
    startDate,
    endDate,
  };
}

export interface ImportLoanContext {
  borrowerId: string;
  /** The uploader: actor on the audit entry and requester of the loan. */
  actorId: string;
  rates: ImportLoan['rates'];
  /** An asset row's commodity (CommoditiesService.ensure). */
  commodityId?: string;
}

/**
 * The loan as LedgerService.importLoan books it. A cash row owes TOTAL: AMOUNT/ITEM is the
 * principal, the rest the interest agreed. An asset row's price already includes everything it
 * costs, so TOTAL is the principal and there is no interest.
 */
export function importLoanInput(row: ImportRow, context: ImportLoanContext): ImportLoan {
  const principal = row.cashPrincipal ?? row.totalRepayable;
  return {
    borrowerId: context.borrowerId,
    category: row.cashPrincipal ? 'PERSONAL' : 'ASSET_PURCHASE',
    principal,
    interest: row.cashPrincipal ? money(row.totalRepayable.minus(principal)) : ZERO,
    repaid: row.repaid,
    // TENOR is the months still to deduct from START DATE: OUTSTANDING spread over them is the sheet's MONTHLY
    // DEDUCTION. Counting them again from the first unsent payroll month would squeeze the balance into fewer months.
    monthsLeft: row.tenure,
    disbursedAt: row.startDate,
    rates: context.rates,
    commodityId: row.cashPrincipal ? undefined : context.commodityId,
    requestedById: context.actorId,
    actorId: context.actorId,
    note: `Imported running loan: ${row.tenure} months left from ${dmy(row.startDate)}`,
  };
}

export interface Officer {
  id: string;
  /** Lower case. */
  name: string;
}

/** v1's rule: the first admin whose name contains the MARKETER cell, ignoring case. */
export function matchOfficer(officers: Officer[], marketerName: string | null): string | null {
  const search = marketerName?.trim().toLowerCase();
  if (!search) return null;
  return officers.find((officer) => officer.name.includes(search))?.id ?? null;
}

/** What a unique-constraint clash (Prisma P2002) on an imported row means, by the fields it names. */
export function duplicateMessage(target: unknown, row: ImportRow): string {
  const fields = Array.isArray(target) ? target.join(',') : String(target ?? '');
  // A phone-only user's email is a placeholder made from the phone number.
  if (/phone|email/i.test(fields)) return `Phone number ${row.phoneNumber} is already registered`;
  if (/externalId/i.test(fields)) return `IPPIS ${row.externalId} is already registered`;
  if (/accountNumber/i.test(fields)) return `Account number ${row.accountNumber} is already registered`;
  if (/bvn/i.test(fields)) return `BVN ${row.bvn} is already registered`;
  return 'This customer is already registered';
}

/** The summary's text: counts, then the first `limit` row errors. */
/**
 * Why an imported loan deserves a second look, or null. A cash loan whose total repayable equals its principal
 * was booked with no interest, so its repayments will all go to principal: usually a sheet mistake.
 */
export function importLoanWarning(loan: ImportLoan): string | null {
  if (loan.category === 'ASSET_PURCHASE') return null;
  return money(loan.interest).lte(0)
    ? 'imported with no interest (the total repayable equals the cash amount), so its repayments all go to principal. Check the sheet.'
    : null;
}

/** Assets have no interest split in the sheet: their whole repayable is booked as principal, by design. */
export const assetLoansNote = (count: number) =>
  `${plural(count, 'asset loan')} booked with the full repayable as principal (the sheet has no interest split for assets), so their repayments show no interest.`;

export function importSummaryText(summary: ImportSummary, limit: number): string {
  const lines =
    summary.total === 0
      ? ['The sheet had no rows with an IPPIS number, so nobody was imported.']
      : [`Imported ${summary.imported} of ${plural(summary.total, 'customer')}; ${summary.failed} failed.`];
  if (summary.skipped) {
    const were = summary.skipped === 1 ? 'was' : 'were';
    lines.push(`${plural(summary.skipped, 'row')} without an IPPIS number ${were} skipped.`);
  }
  if (summary.errors.length) {
    lines.push('', ...summary.errors.slice(0, limit));
    if (summary.errors.length > limit) lines.push(`…and ${summary.errors.length - limit} more.`);
  }
  if (summary.warnings.length) {
    lines.push('', 'Check these:', ...summary.warnings.slice(0, limit));
    if (summary.warnings.length > limit) lines.push(`…and ${summary.warnings.length - limit} more.`);
  }
  return lines.join('\n');
}
