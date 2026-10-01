import * as XLSX from 'xlsx';

// Spreadsheet helpers for the files the reports queue makes. Kept pure so every file is testable.

export { XLSX_MIME } from 'src/ledger/variation';

export type Cell = string | number;

// Africa/Lagos is UTC+1 all year (no daylight saving).
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** dd/MM/yyyy on the Lagos calendar; '' for no date. */
export function lagosDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const lagos = new Date(new Date(value).getTime() + LAGOS_OFFSET_MS);
  return `${pad(lagos.getUTCDate())}/${pad(lagos.getUTCMonth() + 1)}/${lagos.getUTCFullYear()}`;
}

/** yyyy-MM-dd on the Lagos calendar, for file names. */
export function lagosDay(value: Date): string {
  const lagos = new Date(value.getTime() + LAGOS_OFFSET_MS);
  return `${lagos.getUTCFullYear()}-${pad(lagos.getUTCMonth() + 1)}-${pad(lagos.getUTCDate())}`;
}

/** Sheet names are capped at 31 characters and can't contain : \ / ? * [ ]. */
function sheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet1';
}

/** One sheet with these columns in this order (kept even when there are no rows). */
export function rowsWorkbook(name: string, columns: readonly string[], rows: Record<string, Cell>[]): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows, { header: [...columns] }), sheetName(name));
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** One sheet laid out row by row (a header block, then a table). */
export function gridWorkbook(name: string, grid: Cell[][]): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(grid), sheetName(name));
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
