import * as XLSX from 'xlsx';

// Spreadsheet helpers for the files the reports queue makes. Kept pure so every file is testable.

export { XLSX_MIME } from 'src/ledger/variation';

export type Cell = string | number;
/** A numeric cell with its own number format (e.g. naira). */
export type FormattedCell = { t: 'n'; v: number; z: string };
export type GridCell = Cell | FormattedCell;
export interface GridSheet {
  name: string;
  grid: GridCell[][];
}

/** Excel number format for naira amounts: ₦1,234.50. */
export const NAIRA_FORMAT = '"₦"#,##0.00';

/** An amount shown as naira but kept a number, so the sheet can still add it up. */
export function nairaCell(value: number): FormattedCell {
  return { t: 'n', v: value, z: NAIRA_FORMAT };
}

// Africa/Lagos is UTC+1 all year (no daylight saving).
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** dd/MM/yyyy on the Lagos calendar; '' for no date. */
export function lagosDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const lagos = new Date(new Date(value).getTime() + LAGOS_OFFSET_MS);
  return `${pad(lagos.getUTCDate())}/${pad(lagos.getUTCMonth() + 1)}/${lagos.getUTCFullYear()}`;
}

/** dd/MM/yyyy HH:mm WAT (Lagos time). */
export function lagosDateTime(value: Date | string): string {
  const lagos = new Date(new Date(value).getTime() + LAGOS_OFFSET_MS);
  return `${lagosDate(value)} ${pad(lagos.getUTCHours())}:${pad(lagos.getUTCMinutes())} WAT`;
}

/** yyyyMMddHHmmss in Lagos time, for references and file names. */
export function lagosStamp(value: Date | string): string {
  const lagos = new Date(new Date(value).getTime() + LAGOS_OFFSET_MS);
  return (
    `${lagos.getUTCFullYear()}${pad(lagos.getUTCMonth() + 1)}${pad(lagos.getUTCDate())}` +
    `${pad(lagos.getUTCHours())}${pad(lagos.getUTCMinutes())}${pad(lagos.getUTCSeconds())}`
  );
}

/** HH:mm in Lagos time. */
export function lagosTime(value: Date | string): string {
  const lagos = new Date(new Date(value).getTime() + LAGOS_OFFSET_MS);
  return `${pad(lagos.getUTCHours())}:${pad(lagos.getUTCMinutes())}`;
}

/** yyyy-MM-dd on the Lagos calendar, for file names. */
export function lagosDay(value: Date): string {
  const lagos = new Date(value.getTime() + LAGOS_OFFSET_MS);
  return `${lagos.getUTCFullYear()}-${pad(lagos.getUTCMonth() + 1)}-${pad(lagos.getUTCDate())}`;
}

/** Sheet names are capped at 31 characters and can't contain : \ / ? * [ ]. */
function sheetName(name: string): string {
  return name.replace(/[:/?*[\]]/g, ' ').slice(0, 31) || 'Sheet1';
}

/** One sheet with these columns in this order (kept even when there are no rows). */
export function rowsWorkbook(name: string, columns: readonly string[], rows: Record<string, Cell>[]): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows, { header: [...columns] }), sheetName(name));
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function gridSheet(grid: GridCell[][]): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(grid);
  // Wide enough for the longest value in each column (capped), so nothing opens as ####.
  const widths: number[] = [];
  for (const row of grid) {
    // A one-cell row is a title: it may run on into the empty cells beside it.
    if (row.length < 2) continue;
    row.forEach((cell, index) => {
      const length = typeof cell === 'object' ? String(cell.v).length + 6 : String(cell).length;
      widths[index] = Math.min(Math.max(widths[index] ?? 8, length + 2), 50);
    });
  }
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  return sheet;
}

/** One sheet laid out row by row (a header block, then a table). */
export function gridWorkbook(name: string, grid: GridCell[][]): Buffer {
  return sheetsWorkbook([{ name, grid }]);
}

/** Several row-by-row sheets, in order. */
export function sheetsWorkbook(sheets: GridSheet[]): Buffer {
  const book = XLSX.utils.book_new();
  for (const sheet of sheets) XLSX.utils.book_append_sheet(book, gridSheet(sheet.grid), sheetName(sheet.name));
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
