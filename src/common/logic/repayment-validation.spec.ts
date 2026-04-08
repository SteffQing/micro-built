import { validateHeaders, validateRows } from './repayment-validation';

describe('validateHeaders', () => {
  it('returns valid when all required headers are present (exact lowercase)', () => {
    const result = validateHeaders(['staffid', 'amount', 'employeegross', 'netpay']);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('is case-insensitive and strips spaces', () => {
    const result = validateHeaders(['Staff ID', 'AMOUNT', 'Employee Gross', 'Net Pay']);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('returns all four missing columns when none match', () => {
    const result = validateHeaders(['IPPIS_NUMBER', 'PAYMENT', 'GROSS', 'NET']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['staffid', 'amount', 'employeegross', 'netpay']);
  });

  it('returns only the missing subset when some match', () => {
    const result = validateHeaders(['StaffID', 'Amount', 'GROSS', 'NET']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['employeegross', 'netpay']);
  });

  it('returns invalid for an empty header row', () => {
    const result = validateHeaders([]);
    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(4);
  });
});

describe('validateRows', () => {
  const headers = ['staffid', 'amount', 'employeegross', 'netpay'];

  it('returns valid for clean data', () => {
    const rows = [
      ['EMP001', 71666, 400000, 80000],
      ['EMP002', 0, 350000, 70000], // amount=0 is allowed — consumer skips it
    ];
    const result = validateRows(headers, rows);
    expect(result.valid).toBe(true);
    expect(result.totalRows).toBe(2);
    expect(result.invalidRows).toHaveLength(0);
  });

  it('flags empty staffid', () => {
    const rows = [['', 50000, 400000, 80000]];
    const result = validateRows(headers, rows);
    expect(result.valid).toBe(false);
    expect(result.invalidRows[0].row).toBe(1);
    expect(result.invalidRows[0].issues).toContain('staffid is empty');
  });

  it('flags negative amount', () => {
    const rows = [['EMP001', -100, 400000, 80000]];
    const result = validateRows(headers, rows);
    expect(result.valid).toBe(false);
    expect(result.invalidRows[0].issues).toContain(
      'amount must be a non-negative number',
    );
  });

  it('flags non-numeric employeegross', () => {
    const rows = [['EMP001', 50000, 'N/A', 80000]];
    const result = validateRows(headers, rows);
    expect(result.valid).toBe(false);
    expect(result.invalidRows[0].issues).toContain(
      'employeegross must be a non-negative number',
    );
  });

  it('flags negative netpay', () => {
    const rows = [['EMP001', 50000, 400000, -1]];
    const result = validateRows(headers, rows);
    expect(result.valid).toBe(false);
    expect(result.invalidRows[0].issues).toContain(
      'netpay must be a non-negative number',
    );
  });

  it('flags duplicate staffid on both occurrences', () => {
    const rows = [
      ['EMP001', 50000, 400000, 80000],
      ['EMP002', 50000, 400000, 80000],
      ['EMP001', 60000, 400000, 80000],
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
    const rows = [['', -1, 'bad', -5]];
    const result = validateRows(headers, rows);
    expect(result.invalidRows[0].issues.length).toBeGreaterThanOrEqual(4);
  });

  it('reports correct 1-based row numbers', () => {
    const rows = [
      ['EMP001', 50000, 400000, 80000], // row 1 — valid
      ['EMP002', 50000, 400000, 80000], // row 2 — valid
      ['', 50000, 400000, 80000],       // row 3 — invalid
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
