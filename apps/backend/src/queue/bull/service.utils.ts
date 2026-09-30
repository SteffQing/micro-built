const HEADER_MAP: Record<string, string> = {
  IPPIS: 'externalId',
  NAME: 'name',
  ORGANIZATION: 'organization',
  ORGANISATION: 'organization',
  COMMAND: 'command',
  MARKETER: 'marketerName',
  'AMOUNT/ITEM': 'principal',
  TOTAL: 'totalRepayable',
  'AMOUNT PAID': 'repaid',
  'OUTSTANDING BALANCE': 'outstanding',
  'MONTHLY DEDUCTION': 'monthlyDeduction',
  'START DATE': 'startDate',
  'END DATE': 'endDate',
  'BANK NAME': 'bankName',
  BVN: 'bvn',
  'PHONE NUMBER': 'contact',

  TENURE: 'tenure',
  TENOR: 'tenure', // Maps alias to same key
  'ACC. NUMBER': 'accountNumber',
  'ACCOUNT NUMBER': 'accountNumber',
  PHONE: 'contact',
};

const REQUIRED_SYSTEM_KEYS = [
  'externalId',
  'name',
  'accountNumber',
  'bvn',
  'principal',
  'totalRepayable',
  'outstanding',
  'tenure',
  'startDate',
  'command',
  'organization',
];

export { REQUIRED_SYSTEM_KEYS, HEADER_MAP };

function parseDecimal(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const clean = String(value).replace(/[^0-9.-]+/g, '');
  return parseFloat(clean) || 0;
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  // Excel 'cellDates: true' might pass a JS Date object already
  if (value instanceof Date) return value;

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function isNumericExcelValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number' && !isNaN(value)) return true;

  if (typeof value === 'string') {
    return /^-?\d+(\.\d+)?$/.test(value.trim());
  }
  return false;
}

export { parseDate, parseDecimal, isNumericExcelValue };
