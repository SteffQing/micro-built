import {
  extractRepaymentPeriod,
  isExcelBuffer,
  validateHeaders,
  validateRows,
} from './repayment-validation';

describe('isExcelBuffer', () => {
  it('accepts a real .xlsx (ZIP) signature', () => {
    expect(isExcelBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(
      true,
    );
  });

  it('accepts a legacy .xls (OLE2) signature', () => {
    expect(isExcelBuffer(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1]))).toBe(
      true,
    );
  });

  it('rejects a text/csv file masquerading as Excel', () => {
    expect(isExcelBuffer(Buffer.from('staffid,amount\n', 'utf8'))).toBe(false);
  });

  it('rejects an empty buffer', () => {
    expect(isExcelBuffer(Buffer.from([]))).toBe(false);
  });
});

describe('validateHeaders', () => {
  it('returns valid when all required headers are present (exact lowercase)', () => {
    const result = validateHeaders([
      'staffid',
      'amount',
      'fullname',
      'period',
      'organization',
    ]);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('is case-insensitive, strips spaces, and accepts organization aliases', () => {
    const result = validateHeaders([
      'Staff ID',
      'AMOUNT',
      'Full Name',
      'Period',
      'Sub Organization',
    ]);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('returns all missing columns when none match', () => {
    const result = validateHeaders(['IPPIS_NUMBER', 'PAYMENT', 'GROSS', 'NET']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual([
      'staffid',
      'amount',
      'fullname',
      'period',
      'organization (one of: mda, organization, company, sub organization)',
    ]);
  });

  it('returns only the missing subset when some match', () => {
    const result = validateHeaders([
      'StaffID',
      'Amount',
      'Full Name',
      'Period',
    ]);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual([
      'organization (one of: mda, organization, company, sub organization)',
    ]);
  });

  it('returns invalid for an empty header row', () => {
    const result = validateHeaders([]);
    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(5);
  });
});

describe('validateRows', () => {
  const headers = ['staffid', 'amount', 'fullname', 'period', 'organization'];

  it('returns valid for clean data', () => {
    const rows = [
      ['EMP001', 71666, 400000, 80000, 'FEDERAL'],
      ['EMP002', 0, 350000, 70000, 'POLICE'], // amount=0 is allowed — consumer skips it
    ];
    const result = validateRows(headers, rows);
    expect(result.valid).toBe(true);
    expect(result.totalRows).toBe(2);
    expect(result.invalidRows).toHaveLength(0);
  });

  it('flags empty staffid', () => {
    const rows = [['', 50000, 400000, 80000, 'FEDERAL']];
    const result = validateRows(headers, rows);
    expect(result.valid).toBe(false);
    expect(result.invalidRows[0].row).toBe(1);
    expect(result.invalidRows[0].issues).toContain(
      'staffid (IPPIS ID) is empty',
    );
  });

  it('flags negative amount', () => {
    const rows = [['EMP001', -100, 400000, 80000, 'FEDERAL']];
    const result = validateRows(headers, rows);
    expect(result.valid).toBe(false);
    expect(result.invalidRows[0].issues).toContain(
      'amount must be a non-negative number',
    );
  });

  it('flags empty organization after alias normalisation', () => {
    const rows = [['EMP001', 50000, 400000, 80000, '']];
    const result = validateRows(headers, rows);
    expect(result.valid).toBe(false);
    expect(result.invalidRows[0].issues).toContain('organization is empty');
  });

  it('allows non-positive employee gross and netpay during row validation', () => {
    const rows = [['EMP001', 50000, 0, -1, 'FEDERAL']];
    const result = validateRows(headers, rows);
    expect(result.valid).toBe(true);
    expect(result.invalidRows).toHaveLength(0);
  });

  it('flags duplicate staffid on both occurrences', () => {
    const rows = [
      ['EMP001', 50000, 400000, 80000, 'FEDERAL'],
      ['EMP002', 50000, 400000, 80000, 'POLICE'],
      ['EMP001', 60000, 400000, 80000, 'FEDERAL'],
    ];
    const result = validateRows(headers, rows);
    expect(result.valid).toBe(false);
    const dupRows = result.invalidRows.filter((r) =>
      r.issues.includes('duplicate staffid'),
    );
    expect(dupRows).toHaveLength(2);
    expect(dupRows.map((r) => r.row).sort()).toEqual([1, 3]);
  });

  it('aggregates multiple issues on the same row', () => {
    const rows = [['', -1, 'bad', -5, '']];
    const result = validateRows(headers, rows);
    expect(result.invalidRows[0].issues).toEqual([
      'staffid (IPPIS ID) is empty',
      'amount must be a non-negative number',
      'organization is empty',
    ]);
  });

  it('reports correct 1-based row numbers', () => {
    const rows = [
      ['EMP001', 50000, 400000, 80000, 'FEDERAL'], // row 1 — valid
      ['EMP002', 50000, 400000, 80000, 'POLICE'], // row 2 — valid
      ['', 50000, 400000, 80000, 'ARMY'], // row 3 — invalid
    ];
    const result = validateRows(headers, rows);
    expect(result.invalidRows[0].row).toBe(3);
  });

  it('returns empty invalidRows and totalRows=0 for empty data', () => {
    const result = validateRows(headers, []);
    expect(result.valid).toBe(true);
    expect(result.totalRows).toBe(0);
    expect(result.invalidRows).toHaveLength(0);
  });
});

describe('extractRepaymentPeriod', () => {
  const headers = ['staffid', 'amount', 'fullname', 'period', 'organization'];

  it('returns the single period found in populated rows', () => {
    expect(
      extractRepaymentPeriod(headers, [
        ['EMP001', 50000, 'Jane Doe', 'june 2026', 'FEDERAL'],
        ['EMP002', 60000, 'John Doe', 'JUNE 2026', 'POLICE'],
      ]),
    ).toBe('JUNE 2026');
  });

  it('normalizes Excel date serial periods', () => {
    expect(
      extractRepaymentPeriod(headers, [
        ['EMP001', 50000, 'Jane Doe', 46109, 'FEDERAL'],
      ]),
    ).toBe('MARCH 2026');
  });

  it('ignores blank rows while extracting period', () => {
    expect(
      extractRepaymentPeriod(headers, [
        ['', '', '', '', ''],
        ['EMP001', 50000, 'Jane Doe', 'JUNE 2026', 'FEDERAL'],
      ]),
    ).toBe('JUNE 2026');
  });

  it('throws when no period values exist in populated rows', () => {
    expect(() =>
      extractRepaymentPeriod(headers, [['EMP001', 50000, 'Jane Doe', '', 'FEDERAL']]),
    ).toThrow('Period column is empty');
  });

  it('throws when more than one period exists in the same document', () => {
    expect(() =>
      extractRepaymentPeriod(headers, [
        ['EMP001', 50000, 'Jane Doe', 'JUNE 2026', 'FEDERAL'],
        ['EMP002', 60000, 'John Doe', 'JULY 2026', 'POLICE'],
      ]),
    ).toThrow('Repayment document must contain exactly one period value');
  });
});
