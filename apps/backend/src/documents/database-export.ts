import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import * as XLSX from 'xlsx';

// The whole-database export's pure parts (kept apart so they can be tested without a database): which columns never
// leave the database, how a table becomes sheets, and how the file's password waits in the queue.

/**
 * Columns that would let whoever holds the file sign in as someone: session tokens, password hashes, OAuth tokens,
 * 2FA secrets and backup codes, pending verification values. The export says they exist, never what they hold.
 */
export const WITHHELD_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  session: ['token'],
  account: ['password', 'accessToken', 'refreshToken', 'idToken'],
  verification: ['value'],
  twoFactor: ['secret', 'backupCodes'],
};

export const WITHHELD = '[withheld]';

/** Excel's limits: rows per sheet (the header takes one) and characters per cell. */
const MAX_DATA_ROWS = 1_048_575;
const MAX_CELL = 32_767;
const TRUNCATED = '…[truncated]';

/** A Postgres identifier, quoted (names come from information_schema, but quoting is never optional). */
export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * The SELECT for one page of a table: every column as text (numbers, dates and JSON exactly as Postgres prints them,
 * with nothing lost to JavaScript), withheld columns replaced in the database so their values are never read.
 * Ordered by ctid: stable within the export's snapshot, so pages neither overlap nor skip.
 */
export function pageQuery(table: string, columns: readonly string[]): string {
  const withheld = new Set(WITHHELD_COLUMNS[table] ?? []);
  const cells = columns.map((column) =>
    withheld.has(column)
      ? `CASE WHEN ${quoteIdent(column)} IS NULL THEN NULL ELSE '${WITHHELD}' END`
      : `${quoteIdent(column)}::text`,
  );
  return `SELECT ARRAY[${cells.join(', ')}]::text[] AS r FROM ${quoteIdent(table)} ORDER BY ctid LIMIT $1 OFFSET $2`;
}

export interface TableDump {
  table: string;
  columns: string[];
  rows: (string | null)[][];
}

export interface ExportedTable {
  table: string;
  rows: number;
  /** The sheet(s) it is on: a table longer than a sheet continues on "name (2)", … */
  sheets: string[];
}

export interface DatabaseWorkbook {
  body: Buffer;
  tables: ExportedTable[];
  totalRows: number;
  /** Cells longer than Excel holds, cut short and marked. */
  truncatedCells: number;
}

/** Sheet names: at most 31 characters, none of : \ / ? * [ ], unique ignoring case. */
function sheetNamer() {
  const used = new Set<string>();
  return (base: string): string => {
    const clean = base.replace(/[:\\/?*[\]]/g, ' ').trim() || 'Sheet';
    for (let n = 1; ; n++) {
      const suffix = n === 1 ? '' : ` (${n})`;
      const name = `${clean.slice(0, 31 - suffix.length)}${suffix}`;
      if (!used.has(name.toLowerCase())) {
        used.add(name.toLowerCase());
        return name;
      }
    }
  };
}

/**
 * One workbook: an "About" sheet first (what this is, when, by whom, the tables and their row counts), then every
 * table on its own sheet with its column names as the header row.
 */
export function databaseWorkbook(
  dumps: readonly TableDump[],
  about: { exportId: string; madeAt: string; madeBy: string; reason: string },
): DatabaseWorkbook {
  const book = XLSX.utils.book_new();
  const name = sheetNamer();
  name('About');
  let truncatedCells = 0;
  const cell = (value: string | null) => {
    if (value === null || value.length <= MAX_CELL) return value;
    truncatedCells++;
    return value.slice(0, MAX_CELL - TRUNCATED.length) + TRUNCATED;
  };

  const tables: ExportedTable[] = [];
  const sheets: [string, XLSX.WorkSheet][] = [];
  for (const dump of dumps) {
    const names: string[] = [];
    for (let start = 0; start === 0 || start < dump.rows.length; start += MAX_DATA_ROWS) {
      const sheetName = name(dump.table);
      const page = dump.rows.slice(start, start + MAX_DATA_ROWS).map((row) => row.map(cell));
      sheets.push([sheetName, XLSX.utils.aoa_to_sheet([dump.columns, ...page])]);
      names.push(sheetName);
    }
    tables.push({ table: dump.table, rows: dump.rows.length, sheets: names });
  }
  const totalRows = tables.reduce((sum, table) => sum + table.rows, 0);

  const withheld = Object.entries(WITHHELD_COLUMNS).map(([table, columns]) => `${table}: ${columns.join(', ')}`);
  const aboutRows: (string | number)[][] = [
    ['MicroBuilt Prime database export'],
    [],
    ['Export', about.exportId],
    ['Made', about.madeAt],
    ['By', about.madeBy],
    ['Reason', about.reason],
    ['Tables', tables.length],
    ['Rows', totalRows],
    [],
    ['Every table as it stood at one moment (a single read-only snapshot). Values are as the database stores them:'],
    ['times are UTC, amounts are exact decimals, JSON is text.'],
    [`Withheld (they would let the holder sign in as someone): ${withheld.join('; ')}.`],
    ...(truncatedCells
      ? [[`${truncatedCells} cell(s) were longer than Excel allows and end in ${TRUNCATED}.`]]
      : []),
    [],
    ['Table', 'Rows', 'Sheet'],
    ...tables.map((table) => [table.table, table.rows, table.sheets.join(', ')]),
  ];
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(aboutRows), 'About');
  for (const [sheetName, sheet] of sheets) XLSX.utils.book_append_sheet(book, sheet, sheetName);

  const body = XLSX.write(book, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer;
  return { body, tables, totalRows, truncatedCells };
}

// ── The file's password, while the job waits in Redis ──────────────────────────────────────────────────────────
// The super admin chooses it when they ask; the job needs it to encrypt the file. It is never stored or logged:
// in the job it is sealed with a key derived from BETTER_AUTH_SECRET, and the job is removed once it finishes.

function sealKey(secret = process.env.BETTER_AUTH_SECRET): Buffer {
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set');
  return createHash('sha256').update(`database-export:${secret}`).digest();
}

export function sealPassword(password: string, secret?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sealKey(secret), iv);
  const sealed = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), sealed].map((part) => part.toString('base64url')).join('.');
}

export function openPassword(sealed: string, secret?: string): string {
  const [iv, tag, body] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !body) throw new Error('The export password could not be read; request the export again');
  const decipher = createDecipheriv('aes-256-gcm', sealKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}
