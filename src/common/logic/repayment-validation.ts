export const REQUIRED_REPAYMENT_HEADERS = [
  'staffid',
  'amount',
  'employeegross',
  'netpay',
] as const;

export interface HeaderValidationResult {
  valid: boolean;
  missing: string[];
}

export interface RowIssue {
  row: number; // 1-based data row index
  staffId: string;
  issues: string[];
}

export interface RowValidationResult {
  valid: boolean;
  totalRows: number;
  invalidRows: RowIssue[];
}

function normalise(headers: string[]): string[] {
  return headers.map((h) => String(h).toLowerCase().replace(/\s+/g, ''));
}

export function validateHeaders(headers: string[]): HeaderValidationResult {
  const norm = normalise(headers);
  const missing = REQUIRED_REPAYMENT_HEADERS.filter((r) => !norm.includes(r));
  return { valid: missing.length === 0, missing };
}

export function validateRows(
  headers: string[],
  dataRows: any[][],
): RowValidationResult {
  const norm = normalise(headers);
  const idx = (col: string) => norm.indexOf(col);

  const staffIdx = idx('staffid');
  const amtIdx = idx('amount');
  const grossIdx = idx('employeegross');
  const netIdx = idx('netpay');

  const seenStaffIds = new Map<string, number>(); // staffId → first row number
  const rowIssueMap = new Map<number, RowIssue>();

  const addIssue = (rowNum: number, staffId: string, issue: string) => {
    if (!rowIssueMap.has(rowNum)) {
      rowIssueMap.set(rowNum, { row: rowNum, staffId, issues: [] });
    }
    const entry = rowIssueMap.get(rowNum)!;
    if (!entry.issues.includes(issue)) entry.issues.push(issue);
  };

  dataRows.forEach((row, i) => {
    const rowNum = i + 1;

    const staffId = staffIdx > -1 ? String(row[staffIdx] ?? '').trim() : '';
    const amount = amtIdx > -1 ? parseFloat(row[amtIdx]) : NaN;
    const gross = grossIdx > -1 ? parseFloat(row[grossIdx]) : NaN;
    const net = netIdx > -1 ? parseFloat(row[netIdx]) : NaN;

    if (!staffId) addIssue(rowNum, staffId, 'staffid is empty');

    if (isNaN(amount) || amount < 0)
      addIssue(rowNum, staffId, 'amount must be a non-negative number');

    if (isNaN(gross) || gross < 0)
      addIssue(rowNum, staffId, 'employeegross must be a non-negative number');

    if (isNaN(net) || net < 0)
      addIssue(rowNum, staffId, 'netpay must be a non-negative number');

    if (staffId) {
      if (seenStaffIds.has(staffId)) {
        addIssue(rowNum, staffId, 'duplicate staffid');
        addIssue(seenStaffIds.get(staffId)!, staffId, 'duplicate staffid');
      } else {
        seenStaffIds.set(staffId, rowNum);
      }
    }
  });

  const invalidRows = Array.from(rowIssueMap.values()).sort(
    (a, b) => a.row - b.row,
  );

  return {
    valid: invalidRows.length === 0,
    totalRows: dataRows.length,
    invalidRows,
  };
}
