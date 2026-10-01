import { comparePeriods, periodLabel, toYm, type Period } from '@microbuilt/shared';
import { periodFromPayrollCell } from 'src/ledger/period';
import * as XLSX from 'xlsx';
import type { PayrollRowIssue } from '../types/repayment.interface';

// Reading and checking a government payroll return (one Excel sheet, one row per employee). Pure:
// no database. The upload and validate endpoints run these checks, then add the ones that need the
// database (the month's state, a file already uploaded); the queue reads the stored sheet again.

/** Header names after normalising (lower case, letters and digits only). */
export const REQUIRED_PAYROLL_COLUMNS = ['staffid', 'amount', 'fullname', 'period'] as const;

export const ORGANIZATION_HEADER_ALIASES = ['mda', 'organization', 'company', 'suborganization'] as const;

const ORGANIZATION_MISSING_LABEL = 'organization (one of: MDA, Organization, Company, Sub Organization)';

/** Rows named in one problem sentence before "and N more". */
const LISTED_ROWS = 20;
/** Rows described in the "fix these rows" sentence. */
const DESCRIBED_ROWS = 10;

// Magic bytes, not the client's MIME type: .xlsx is a ZIP (PK\x03\x04), legacy .xls an OLE2 file.
const FILE_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0xd0, 0xcf, 0x11, 0xe0],
];

export function isExcelBuffer(buffer: Buffer): boolean {
  return FILE_SIGNATURES.some((signature) => signature.every((byte, i) => buffer[i] === byte));
}

/** The file isn't a readable Excel workbook: nothing in it can be checked. */
export class PayrollSheetError extends Error {}

/** The employee details a row carries; only non-empty / > 0 values update CustomerPayroll. */
export interface PayrollDetails {
  grade: string;
  step: number;
  command: string;
  organization: string;
  employeeGross: number;
  netPay: number;
}

export interface PayrollRow {
  /** The sheet's own row number (the header is row 1 when the sheet starts at the top). */
  row: number;
  staffId: string;
  fullName: string;
  /** Naira deducted; null when the cell is empty or not a number. */
  amount: number | null;
  /** Null when the Period cell is empty or isn't a month; `periodError` says which. */
  period: Period | null;
  periodError?: string;
  payroll: PayrollDetails;
}

export interface PayrollSheet {
  missingColumns: string[];
  /** Data rows; blank rows are left out. */
  rows: PayrollRow[];
}

export interface PayrollSheetCheck {
  /** The month most rows are for; null when no row's Period could be read. */
  period: Period | null;
  rows: number;
  missingColumns: string[];
  /** Plain sentences, most important first. Empty = the sheet can be uploaded. */
  problems: string[];
  invalidRows: PayrollRowIssue[];
}

/** Where an uploaded sheet is stored in PAYROLL_UPLOADS_BUCKET. */
export function payrollUploadPath(period: Period, fileHash: string): string {
  return `${toYm(period)}/${fileHash}.xlsx`;
}

function normaliseHeader(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function numberOf(value: unknown): number | null {
  const raw = text(value).replace(/[\s,₦]/g, '');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function readPeriod(value: unknown): Pick<PayrollRow, 'period' | 'periodError'> {
  const raw = text(value);
  if (!raw) return { period: null, periodError: 'period is empty' };
  try {
    return { period: periodFromPayrollCell(raw) };
  } catch {
    return { period: null, periodError: `period "${raw}" is not a month` };
  }
}

/**
 * Reads the first sheet: its first used row is the header, the rest are employees. Throws
 * PayrollSheetError when the file isn't an Excel workbook.
 */
export function readPayrollSheet(buffer: Buffer): PayrollSheet {
  if (!isExcelBuffer(buffer)) throw new PayrollSheetError('Upload the payroll as an Excel file (.xlsx or .xls)');
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new PayrollSheetError('The file could not be read as an Excel workbook');
  }
  const sheet = workbook.SheetNames[0] ? workbook.Sheets[workbook.SheetNames[0]] : undefined;
  if (!sheet) throw new PayrollSheetError('The workbook has no sheets');

  // Date cells stay Excel serials (periodFromPayrollCell reads them on the calendar, no time zone).
  const [headerRow = [], ...dataRows] = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: true,
  });
  const firstRow = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']).s.r + 1 : 1;

  const headers = headerRow.map(normaliseHeader);
  const column = (name: string) => headers.indexOf(name);
  const organization = headers.findIndex((header) =>
    (ORGANIZATION_HEADER_ALIASES as readonly string[]).includes(header),
  );
  const missingColumns: string[] = REQUIRED_PAYROLL_COLUMNS.filter((name) => column(name) === -1);
  if (organization === -1) missingColumns.push(ORGANIZATION_MISSING_LABEL);

  const at = (row: unknown[], index: number) => (index === -1 ? '' : row[index]);
  const rows: PayrollRow[] = [];
  dataRows.forEach((row, index) => {
    if (!Array.isArray(row) || row.every((cell) => text(cell) === '')) return;
    const step = numberOf(at(row, column('step')));
    rows.push({
      row: firstRow + 1 + index,
      staffId: text(at(row, column('staffid'))),
      fullName: text(at(row, column('fullname'))),
      amount: numberOf(at(row, column('amount'))),
      ...readPeriod(at(row, column('period'))),
      payroll: {
        grade: text(at(row, column('grade'))),
        step: step !== null && Number.isInteger(step) ? step : 0,
        command: text(at(row, column('command'))),
        organization: text(at(row, organization)),
        employeeGross: numberOf(at(row, column('employeegross'))) ?? 0,
        netPay: numberOf(at(row, column('netpay'))) ?? 0,
      },
    });
  });
  return { missingColumns, rows };
}

/** The month most rows are for (the earliest-seen one on a tie). */
function sheetPeriod(rows: PayrollRow[]): Period | null {
  const counts = new Map<string, { period: Period; count: number }>();
  for (const { period } of rows) {
    if (!period) continue;
    const key = toYm(period);
    const entry = counts.get(key) ?? { period, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  let best: { period: Period; count: number } | null = null;
  for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry;
  return best?.period ?? null;
}

function rowList(rows: number[]): string {
  const listed = rows.slice(0, LISTED_ROWS).join(', ');
  return rows.length > LISTED_ROWS ? `${listed} and ${rows.length - LISTED_ROWS} more` : listed;
}

/**
 * Everything wrong with a sheet that can be told without the database: missing columns, rows
 * without a staff ID or a usable amount, the same staff ID twice, and rows for different months.
 * `requested` is the month the uploader said the sheet is for, if they did.
 */
export function checkPayrollSheet(sheet: PayrollSheet, requested?: Period): PayrollSheetCheck {
  const { missingColumns, rows } = sheet;
  if (missingColumns.length) {
    return {
      period: null,
      rows: rows.length,
      missingColumns,
      problems: [`The sheet is missing these columns: ${missingColumns.join(', ')}`],
      invalidRows: [],
    };
  }
  if (!rows.length) {
    return { period: null, rows: 0, missingColumns, problems: ['The sheet has no payroll rows'], invalidRows: [] };
  }

  const period = sheetPeriod(rows);
  const byRow = new Map<number, PayrollRowIssue>();
  const add = (row: PayrollRow, issue: string) => {
    const entry = byRow.get(row.row) ?? { row: row.row, staffId: row.staffId, issues: [] };
    if (!entry.issues.includes(issue)) entry.issues.push(issue);
    byRow.set(row.row, entry);
  };
  const otherMonth: number[] = [];
  const firstRowOf = new Map<string, PayrollRow>();

  for (const row of rows) {
    if (!row.staffId) add(row, 'staffid (IPPIS number) is empty');
    if (row.amount === null || row.amount < 0) add(row, 'amount must be a number of naira, 0 or more');
    if (row.periodError) add(row, row.periodError);
    if (row.period && period && comparePeriods(row.period, period) !== 0) {
      otherMonth.push(row.row);
      add(row, `period is ${periodLabel(row.period)}, not ${periodLabel(period)}`);
    }
    if (row.staffId) {
      const first = firstRowOf.get(row.staffId);
      if (first) {
        add(first, 'duplicate staffid');
        add(row, 'duplicate staffid');
      } else {
        firstRowOf.set(row.staffId, row);
      }
    }
  }

  const invalidRows = [...byRow.values()].sort((a, b) => a.row - b.row);
  const problems: string[] = [];
  if (!period) {
    problems.push('No row has a Period that can be read as a month (for example JUNE 2026, 2026-06 or a date)');
  }
  if (period && otherMonth.length) {
    problems.push(
      `Every row must be for the same month. These rows are not for ${periodLabel(period)}: ${rowList(otherMonth)}`,
    );
  }
  if (period && requested && comparePeriods(period, requested) !== 0) {
    problems.push(`This sheet is for ${periodLabel(period)}, not ${periodLabel(requested)}`);
  }
  const toFix = invalidRows.filter(({ row, issues }) => !(otherMonth.includes(row) && issues.length === 1));
  if (toFix.length) {
    const described = toFix
      .slice(0, DESCRIBED_ROWS)
      .map(({ row, issues }) => `row ${row}: ${issues.join(', ')}`)
      .join('; ');
    const more = toFix.length > DESCRIBED_ROWS ? `; and ${toFix.length - DESCRIBED_ROWS} more rows` : '';
    problems.push(`Fix ${toFix.length === 1 ? 'this row' : `these ${toFix.length} rows`}: ${described}${more}`);
  }

  return { period, rows: rows.length, missingColumns, problems, invalidRows };
}
