import { parseDateToPeriod, parsePeriodToDate } from '../utils';

export const REQUIRED_REPAYMENT_HEADERS = [
  'staffid',
  'amount',
  'fullname',
  'period',
] as const;

export const ORGANIZATION_HEADER_ALIASES = [
  'mda',
  'organization',
  'company',
  'suborganization',
] as const;

const ORGANIZATION_MISSING_LABEL =
  'organization (one of: mda, organization, company, sub organization)';

// ponytail: magic-byte sniff instead of trusting the client-set MIME type.
// .xlsx is a ZIP (PK\x03\x04); legacy .xls is an OLE2 compound file.
const FILE_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04], // xlsx / zip
  [0xd0, 0xcf, 0x11, 0xe0], // xls / ole2
];

export function isExcelBuffer(buffer: Buffer): boolean {
  return FILE_SIGNATURES.some((sig) => sig.every((b, i) => buffer[i] === b));
}

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

function normalise(
  headers: Array<string | number | null | undefined>,
): string[] {
  return headers.map((h) =>
    String(h ?? '')
      .toLowerCase()
      .replace(/\s+/g, ''),
  );
}

function isRowEmpty(row: any[]): boolean {
  return row.every((cell) => String(cell ?? '').trim() === '');
}

function formatPeriod(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw new Error('Period column is empty');
  }

  return parseDateToPeriod(parsePeriodToDate(raw));
}

export function getOrganizationHeaderIndex(normalized: string[]): number {
  return normalized.findIndex((header) =>
    ORGANIZATION_HEADER_ALIASES.includes(
      header as (typeof ORGANIZATION_HEADER_ALIASES)[number],
    ),
  );
}

export function extractRepaymentPeriod(
  headers: Array<string | number | null | undefined>,
  dataRows: any[][],
): string {
  const normalizedHeaders = normalise(headers);
  const periodIndex = normalizedHeaders.indexOf('period');

  if (periodIndex === -1) {
    throw new Error('Missing period column');
  }

  const periods = new Set<string>();

  for (const row of dataRows) {
    if (isRowEmpty(row)) {
      continue;
    }

    const rawPeriod = row?.[periodIndex];
    if (String(rawPeriod ?? '').trim() === '') {
      continue;
    }

    try {
      periods.add(formatPeriod(rawPeriod));
    } catch {
      throw new Error(`Invalid period value: ${rawPeriod}`);
    }
  }

  if (periods.size === 0) {
    throw new Error('Period column is empty');
  }

  if (periods.size > 1) {
    throw new Error('Repayment document must contain exactly one period value');
  }

  return Array.from(periods)[0];
}

export function validateHeaders(headers: string[]): HeaderValidationResult {
  const norm = normalise(headers);
  const missing = REQUIRED_REPAYMENT_HEADERS.filter(
    (r) => !norm.includes(r),
  ) as string[];
  if (getOrganizationHeaderIndex(norm) === -1) {
    missing.push(ORGANIZATION_MISSING_LABEL);
  }
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
  const orgIdx = getOrganizationHeaderIndex(norm);

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
    const organization = orgIdx > -1 ? String(row[orgIdx] ?? '').trim() : '';

    if (!staffId) addIssue(rowNum, staffId, 'staffid (IPPIS ID) is empty');

    if (isNaN(amount) || amount < 0)
      addIssue(rowNum, staffId, 'amount must be a non-negative number');

    if (!organization) addIssue(rowNum, staffId, 'organization is empty');

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
