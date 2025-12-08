const HEADER_MAP: Record<string, string> = {
  IPPIS: 'externalId',
  NAME: 'name',
  ORGANIZATION: 'organization',
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
  'totalRepayable',
  'outstanding',
  'tenure',
  'command',
  'organization',
];

export { REQUIRED_SYSTEM_KEYS, HEADER_MAP };
export type ExistingCustomer = typeof HEADER_MAP;
