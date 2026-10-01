import * as XLSX from 'xlsx';
import {
  checkPayrollSheet,
  isExcelBuffer,
  payrollUploadPath,
  PayrollSheetError,
  readPayrollSheet,
  type PayrollSheet,
} from './repayment-validation';

const HEADER = ['Staff ID', 'Amount', 'Full Name', 'Period', 'MDA'];

function workbook(rows: unknown[][], bookType: XLSX.BookType = 'xlsx'): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Payroll');
  return XLSX.write(book, { type: 'buffer', bookType }) as Buffer;
}

const sheetOf = (rows: unknown[][], header: unknown[] = HEADER): PayrollSheet =>
  readPayrollSheet(workbook([header, ...rows]));

describe('isExcelBuffer', () => {
  it('accepts .xlsx (ZIP) and .xls (OLE2) signatures', () => {
    expect(isExcelBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(true);
    expect(isExcelBuffer(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1]))).toBe(true);
  });

  it('rejects text masquerading as Excel, and an empty buffer', () => {
    expect(isExcelBuffer(Buffer.from('staffid,amount\n', 'utf8'))).toBe(false);
    expect(isExcelBuffer(Buffer.from([]))).toBe(false);
  });
});

describe('readPayrollSheet', () => {
  it('refuses a file that is not an Excel workbook', () => {
    expect(() => readPayrollSheet(Buffer.from('staffid,amount\n1,2'))).toThrow(PayrollSheetError);
  });

  it('reads headers in any case or spacing, organization aliases, and the employee details', () => {
    const sheet = sheetOf(
      [['123456', '71,666.50', 'Ada Obi', 'june 2026', 'NAVY', 'GL 08', 3, 'LAGOS', 250000, 180000]],
      ['STAFF ID', 'amount', 'Full  Name', 'Period', 'Sub-Organization', 'Grade', 'Step', 'Command', 'Employee Gross', 'Net Pay'],
    );
    expect(sheet.missingColumns).toEqual([]);
    expect(sheet.rows).toEqual([
      {
        row: 2,
        staffId: '123456',
        fullName: 'Ada Obi',
        amount: 71666.5,
        period: { year: 2026, month: 'JUNE' },
        payroll: {
          grade: 'GL 08',
          step: 3,
          command: 'LAGOS',
          organization: 'NAVY',
          employeeGross: 250000,
          netPay: 180000,
        },
      },
    ]);
  });

  it('numbers rows as the sheet does, skipping blank rows', () => {
    const sheet = sheetOf([
      ['1', 100, 'A', 'JUNE 2026', 'NAVY'],
      ['', '', '', '', ''],
      ['2', 100, 'B', 'JUNE 2026', 'NAVY'],
    ]);
    expect(sheet.rows.map((row) => row.row)).toEqual([2, 4]);
  });

  it('reads Excel date serials and YYYY-MM in the Period column', () => {
    const sheet = sheetOf([
      ['1', 100, 'A', 46109, 'NAVY'],
      ['2', 100, 'B', '2026-03', 'NAVY'],
    ]);
    expect(sheet.rows.map((row) => row.period)).toEqual([
      { year: 2026, month: 'MARCH' },
      { year: 2026, month: 'MARCH' },
    ]);
  });

  it('names every missing required column', () => {
    expect(sheetOf([], ['IPPIS_NUMBER', 'PAYMENT']).missingColumns).toEqual([
      'staffid',
      'amount',
      'fullname',
      'period',
      'organization (one of: MDA, Organization, Company, Sub Organization)',
    ]);
  });
});

describe('checkPayrollSheet', () => {
  it('passes a clean sheet and reports its month (amount 0 is allowed)', () => {
    const check = checkPayrollSheet(
      sheetOf([
        ['1', 50000, 'A', 'JUNE 2026', 'NAVY'],
        ['2', 0, 'B', 'JUNE 2026', 'ARMY'],
      ]),
    );
    expect(check).toEqual({
      period: { year: 2026, month: 'JUNE' },
      rows: 2,
      missingColumns: [],
      problems: [],
      invalidRows: [],
    });
  });

  it('stops at missing columns', () => {
    const check = checkPayrollSheet(sheetOf([['1', 100]], ['Staff ID', 'Amount']));
    expect(check.problems).toEqual([
      'The sheet is missing these columns: fullname, period, organization (one of: MDA, Organization, Company, Sub Organization)',
    ]);
  });

  it('refuses a sheet with no rows', () => {
    expect(checkPayrollSheet(sheetOf([])).problems).toEqual(['The sheet has no payroll rows']);
  });

  it('flags an empty staff ID, a bad amount and a duplicate staff ID on both rows', () => {
    const check = checkPayrollSheet(
      sheetOf([
        ['', 100, 'A', 'JUNE 2026', 'NAVY'],
        ['7', -5, 'B', 'JUNE 2026', 'NAVY'],
        ['8', 'abc', 'C', 'JUNE 2026', 'NAVY'],
        ['9', 100, 'D', 'JUNE 2026', 'NAVY'],
        ['9', 100, 'E', 'JUNE 2026', 'NAVY'],
      ]),
    );
    expect(check.invalidRows).toEqual([
      { row: 2, staffId: '', issues: ['staffid (IPPIS number) is empty'] },
      { row: 3, staffId: '7', issues: ['amount must be a number of naira, 0 or more'] },
      { row: 4, staffId: '8', issues: ['amount must be a number of naira, 0 or more'] },
      { row: 5, staffId: '9', issues: ['duplicate staffid'] },
      { row: 6, staffId: '9', issues: ['duplicate staffid'] },
    ]);
    expect(check.problems).toEqual([
      'Fix these 5 rows: row 2: staffid (IPPIS number) is empty; row 3: amount must be a number of naira, 0 or more; ' +
        'row 4: amount must be a number of naira, 0 or more; row 5: duplicate staffid; row 6: duplicate staffid',
    ]);
  });

  it('takes the month most rows are for and lists the rows that disagree', () => {
    const check = checkPayrollSheet(
      sheetOf([
        ['1', 100, 'A', 'JUNE 2026', 'NAVY'],
        ['2', 100, 'B', 'JULY 2026', 'NAVY'],
        ['3', 100, 'C', 'JUNE 2026', 'NAVY'],
        ['4', 100, 'D', 'MAY 2026', 'NAVY'],
      ]),
    );
    expect(check.period).toEqual({ year: 2026, month: 'JUNE' });
    expect(check.problems).toEqual(['Every row must be for the same month. These rows are not for JUNE 2026: 3, 5']);
    expect(check.invalidRows).toEqual([
      { row: 3, staffId: '2', issues: ['period is JULY 2026, not JUNE 2026'] },
      { row: 5, staffId: '4', issues: ['period is MAY 2026, not JUNE 2026'] },
    ]);
  });

  it('flags an empty or unreadable Period', () => {
    const check = checkPayrollSheet(
      sheetOf([
        ['1', 100, 'A', 'JUNE 2026', 'NAVY'],
        ['2', 100, 'B', '', 'NAVY'],
        ['3', 100, 'C', 'Juneish', 'NAVY'],
      ]),
    );
    expect(check.invalidRows).toEqual([
      { row: 3, staffId: '2', issues: ['period is empty'] },
      { row: 4, staffId: '3', issues: ['period "Juneish" is not a month'] },
    ]);
    expect(check.problems).toHaveLength(1);
  });

  it('refuses a sheet with no readable month at all', () => {
    const check = checkPayrollSheet(sheetOf([['1', 100, 'A', '', 'NAVY']]));
    expect(check.period).toBeNull();
    expect(check.problems[0]).toMatch(/^No row has a Period that can be read as a month/);
  });

  it('refuses a sheet for another month than the one asked for', () => {
    const check = checkPayrollSheet(sheetOf([['1', 100, 'A', 'JUNE 2026', 'NAVY']]), { year: 2026, month: 'JULY' });
    expect(check.problems).toEqual(['This sheet is for JUNE 2026, not JULY 2026']);
  });
});

describe('payrollUploadPath', () => {
  it('stores a sheet under its month by its hash', () => {
    expect(payrollUploadPath({ year: 2026, month: 'JUNE' }, 'abc123')).toBe('2026-06/abc123.xlsx');
  });
});
