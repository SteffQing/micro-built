import * as XLSX from 'xlsx';
import { databaseWorkbook, openPassword, pageQuery, sealPassword, WITHHELD } from './database-export';

const ABOUT = { exportId: 'DBX-TEST01', madeAt: '13/10/2026 14:10 WAT', madeBy: 'Ada Obi', reason: 'Offline backup' };
const SECRET = 'x'.repeat(40);

describe('pageQuery', () => {
  it('reads every column as text, in a stable order, a page at a time', () => {
    expect(pageQuery('Loan', ['id', 'owed'])).toBe(
      'SELECT ARRAY["id"::text, "owed"::text]::text[] AS r FROM "Loan" ORDER BY ctid LIMIT $1 OFFSET $2',
    );
  });

  it('never reads a sign-in secret: the database answers [withheld] (or null) in its place', () => {
    const sql = pageQuery('account', ['id', 'password', 'accessToken']);
    expect(sql).not.toContain('"password"::text');
    expect(sql).toContain(`CASE WHEN "password" IS NULL THEN NULL ELSE '${WITHHELD}' END`);
    expect(sql).toContain(`CASE WHEN "accessToken" IS NULL THEN NULL ELSE '${WITHHELD}' END`);
    expect(pageQuery('session', ['token'])).not.toContain('"token"::text');
  });

  it('quotes identifiers', () => {
    expect(pageQuery('we"ird', ['co"l'])).toContain('"co""l"::text');
    expect(pageQuery('we"ird', ['col'])).toContain('FROM "we""ird"');
  });
});

describe('databaseWorkbook', () => {
  const read = (body: Buffer) => XLSX.read(body, { type: 'buffer' });
  const rows = (book: XLSX.WorkBook, name: string) => XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], { header: 1 });

  it('puts an About sheet first, then each table with its columns as the header', () => {
    const made = databaseWorkbook(
      [
        { table: 'Loan', columns: ['id', 'owed'], rows: [['LN-1', '136000.00'], ['LN-2', null]] },
        { table: 'user', columns: ['id'], rows: [] },
      ],
      ABOUT,
    );
    expect(made).toMatchObject({ totalRows: 2, truncatedCells: 0 });
    expect(made.tables).toEqual([
      { table: 'Loan', rows: 2, sheets: ['Loan'] },
      { table: 'user', rows: 0, sheets: ['user'] },
    ]);
    const book = read(made.body);
    expect(book.SheetNames).toEqual(['About', 'Loan', 'user']);
    expect(rows(book, 'Loan')).toEqual([['id', 'owed'], ['LN-1', '136000.00'], ['LN-2']]);
    // An empty table still shows its columns.
    expect(rows(book, 'user')).toEqual([['id']]);
    const about = rows(book, 'About').flat();
    expect(about).toEqual(expect.arrayContaining(['DBX-TEST01', 'Ada Obi', 'Offline backup', 'Loan', 'user']));
  });

  it('cuts a cell longer than Excel holds, and says so', () => {
    const made = databaseWorkbook([{ table: 'AuditLog', columns: ['meta'], rows: [['a'.repeat(40_000)]] }], ABOUT);
    expect(made.truncatedCells).toBe(1);
    const cell = rows(read(made.body), 'AuditLog')[1][0] as string;
    expect(cell.length).toBe(32_767);
    expect(cell.endsWith('…[truncated]')).toBe(true);
  });

  it('keeps sheet names unique within 31 characters', () => {
    const long = 'A_very_long_table_name_that_goes_on';
    const made = databaseWorkbook(
      [
        { table: long, columns: ['id'], rows: [] },
        { table: `${long}_too`, columns: ['id'], rows: [] },
        { table: 'about', columns: ['id'], rows: [] },
      ],
      ABOUT,
    );
    const names = made.tables.flatMap((t) => t.sheets);
    expect(names.every((name) => name.length <= 31)).toBe(true);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(3);
    expect(names).toContain('about (2)');
  });
});

describe('the sealed password', () => {
  it('opens with the same secret, and only with it', () => {
    const sealed = sealPassword('correct horse battery', SECRET);
    expect(sealed).not.toContain('correct');
    expect(openPassword(sealed, SECRET)).toBe('correct horse battery');
    expect(() => openPassword(sealed, 'y'.repeat(40))).toThrow();
    expect(() => openPassword('garbage', SECRET)).toThrow('request the export again');
  });

  it('seals the same password differently each time', () => {
    expect(sealPassword('same', SECRET)).not.toBe(sealPassword('same', SECRET));
  });
});
