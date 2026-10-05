import { ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Job } from 'bull';
import { captureJobError } from 'src/common/observability';
import type { ExistingCustomerJob, ImportedCustomerRow } from 'src/common/types/services.queue.interface';
import type { ImportLoan } from 'src/ledger/ledger.service';
import { ServicesConsumer } from './queue.service';
import {
  HEADER_MAP,
  ImportRowError,
  assetLoansNote,
  importLoanInput,
  lagosToday,
  monthsLeft,
  parseImportRow,
  parseSheetDate,
  sheetRows,
} from './service.utils';

// better-auth is ESM-only (D14): the consumer gets a stand-in.
jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
jest.mock('src/common/observability', () => ({ captureJobError: jest.fn() }));

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const NOW = new Date('2026-10-01T09:00:00Z');
const TODAY = lagosToday(NOW);
const OCTOBER_2026 = { year: 2026, month: 'OCTOBER' } as const;
const RATES = { interestRate: D('0.06'), managementFeeRate: D('0.025') };

const HEADERS = [
  'IPPIS',
  'NAME',
  'PHONE NUMBER',
  'ORGANIZATION',
  'COMMAND',
  'MARKETER',
  'AMOUNT/ITEM',
  'TOTAL',
  'AMOUNT PAID',
  'OUTSTANDING BALANCE',
  'TENURE',
  'START DATE',
  'END DATE',
  'BANK NAME',
  'ACCOUNT NUMBER',
  'BVN',
];

/** A sheet row as SheetJS hands it over: start date 15/01/2026 is Excel serial 46037. */
function cells(overrides: Partial<Record<(typeof HEADERS)[number], unknown>> = {}): unknown[] {
  const row: Record<string, unknown> = {
    IPPIS: 112233,
    NAME: 'Ada Obi',
    'PHONE NUMBER': '0803 123 4567',
    ORGANIZATION: 'Nigerian Army',
    COMMAND: 'HQ Lagos',
    MARKETER: 'bola',
    'AMOUNT/ITEM': 500000,
    TOTAL: 590000,
    'AMOUNT PAID': 442500,
    'OUTSTANDING BALANCE': 147500,
    TENURE: 12,
    'START DATE': 46037,
    'END DATE': '',
    'BANK NAME': 'First Bank',
    'ACCOUNT NUMBER': '0123456789',
    BVN: '22212345678',
    ...overrides,
  };
  return HEADERS.map((header) => row[header]);
}

function record(overrides: Parameters<typeof cells>[0] = {}): ImportedCustomerRow {
  const values = cells(overrides);
  return Object.fromEntries(HEADERS.map((header, index) => [HEADER_MAP[header], values[index]]));
}

function job(rows: unknown[][]): Job<ExistingCustomerJob> {
  return {
    id: 'job-1',
    name: 'onboard_existing_customers',
    data: {
      // Row 1 is a title, the header is row 2, data from row 3.
      rawData: [['Existing customers', '', ''], HEADERS, ...rows],
      headerRowIndex: 1,
      columnIndexToKey: Object.fromEntries(HEADERS.map((header, index) => [index, HEADER_MAP[header]])),
      requestedById: 'AD-1',
    },
    progress: jest.fn(),
  } as unknown as Job<ExistingCustomerJob>;
}

describe('existing-customer rows → importLoan', () => {
  it('books a cash row: AMOUNT/ITEM is the principal, the rest of TOTAL the interest', () => {
    const row = parseImportRow(record(), TODAY);
    const input = importLoanInput(row, { borrowerId: 'MB-1', actorId: 'AD-1', firstMonth: OCTOBER_2026, rates: RATES });
    expect(input).toMatchObject({
      borrowerId: 'MB-1',
      category: 'PERSONAL',
      // 12 months from January: January–September are behind it, October–December left.
      monthsLeft: 3,
      disbursedAt: day('2026-01-15'),
      rates: RATES,
      commodityId: undefined,
      requestedById: 'AD-1',
      actorId: 'AD-1',
      note: 'Imported running loan: 12-month tenure from 15/01/2026',
    });
    expect(String(input.principal)).toBe('500000');
    expect(String(input.interest)).toBe('90000');
    expect(String(input.repaid)).toBe('442500');
  });

  it('books an asset row at its price: TOTAL is the principal, no interest, linked to the commodity', () => {
    const row = parseImportRow(record({ 'AMOUNT/ITEM': ' Solar panel ', TOTAL: '₦300,000', 'AMOUNT PAID': 0 }), TODAY);
    expect(row.assetName).toBe('Solar panel');
    const input = importLoanInput(row, {
      borrowerId: 'MB-2',
      actorId: 'AD-1',
      firstMonth: OCTOBER_2026,
      rates: RATES,
      commodityId: 'cm-1',
    });
    expect(input).toMatchObject({ category: 'ASSET_PURCHASE', commodityId: 'cm-1' });
    expect(String(input.principal)).toBe('300000');
    expect(String(input.interest)).toBe('0');
  });

  it('counts the months left through END DATE when the row has one, else from the tenure', () => {
    const start = day('2026-01-15');
    // October 2026 through March 2027.
    expect(monthsLeft({ tenure: 12, startDate: start, endDate: day('2027-03-31') }, OCTOBER_2026)).toBe(6);
    expect(monthsLeft({ tenure: 18, startDate: start, endDate: null }, OCTOBER_2026)).toBe(9);
    // Running past its end, or its tenure: whatever is owed still gets a month.
    expect(monthsLeft({ tenure: 12, startDate: start, endDate: day('2026-05-31') }, OCTOBER_2026)).toBe(1);
    expect(monthsLeft({ tenure: 6, startDate: start, endDate: null }, OCTOBER_2026)).toBe(1);
  });

  it('reads the row the way payroll sheets are written', () => {
    const row = parseImportRow(
      record({
        'PHONE NUMBER': '0803 123 4567 / 0805 000 0000',
        'ACCOUNT NUMBER': 123456789,
        'AMOUNT PAID': '',
        TENURE: '12 months',
        'START DATE': '15/01/2026',
        'END DATE': '31/12/2026',
      }),
      TODAY,
    );
    expect(row).toMatchObject({
      externalId: '112233',
      phoneNumber: '+2348031234567',
      // A number cell lost the leading zero.
      accountNumber: '0123456789',
      tenure: 12,
      startDate: day('2026-01-15'),
      endDate: day('2026-12-31'),
    });
    // No AMOUNT PAID: TOTAL less OUTSTANDING BALANCE.
    expect(String(row.repaid)).toBe('442500');
  });

  it.each([
    [{ 'PHONE NUMBER': '12345' }, 'PHONE NUMBER "12345" is not a Nigerian mobile number'],
    [{ 'PHONE NUMBER': '' }, 'PHONE NUMBER is empty'],
    [{ BVN: '123' }, 'BVN "123" is not an 11-digit BVN'],
    [{ 'ACCOUNT NUMBER': '12-34' }, 'ACCOUNT NUMBER "12-34" is not a 10-digit account number'],
    [{ TOTAL: 400000 }, 'TOTAL (₦400,000) is less than AMOUNT/ITEM (₦500,000)'],
    [{ 'AMOUNT PAID': 600000 }, 'AMOUNT PAID (₦600,000) is more than TOTAL (₦590,000)'],
    [{ 'AMOUNT/ITEM': '500,000.00.00' }, 'AMOUNT/ITEM "500,000.00.00" is neither an amount nor an asset name'],
    [{ TENURE: 'twelve' }, 'TENURE "twelve" is not a number of months'],
    [{ 'START DATE': '2026/13/45' }, 'START DATE "2026/13/45" is not a date (use DD/MM/YYYY)'],
    [{ 'START DATE': '02/10/2026' }, 'START DATE 02/10/2026 is in the future'],
    [{ 'END DATE': '01/01/2026' }, 'END DATE 01/01/2026 is before START DATE 15/01/2026'],
  ])('refuses a row with %j', (overrides, message) => {
    expect(() => parseImportRow(record(overrides), TODAY)).toThrow(new ImportRowError(message));
  });

  it('reads sheet dates without a time zone shifting the day', () => {
    expect(parseSheetDate(46023)).toEqual(day('2026-01-01'));
    expect(parseSheetDate('2026-01-15')).toEqual(day('2026-01-15'));
    expect(parseSheetDate('31/02/2026')).toBeNull();
    // A job queued when dates came as JS dates: local midnight in Lagos, with SheetJS's drift.
    expect(parseSheetDate('2025-12-31T22:59:25.000Z')).toEqual(day('2026-01-01'));
    expect(parseSheetDate('soon')).toBeNull();
  });

  it('numbers rows as the sheet does and only counts rows without an IPPIS number', () => {
    const { data } = job([cells(), ['', '', '', '', '', '', '', 'TOTALS', 1180000], [], cells({ IPPIS: 445566 })]);
    const { rows, skipped } = sheetRows(data);
    expect(rows.map((row) => [row.rowNumber, row.record.externalId])).toEqual([
      [3, 112233],
      [6, 445566],
    ]);
    expect(skipped).toBe(1);
  });
});

describe('ServicesConsumer (existing-customer upload)', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  function setup() {
    const tx = {
      customer: { create: jest.fn() },
      customerPayroll: { create: jest.fn() },
      customerPaymentMethod: { create: jest.fn() },
    };
    const prisma = {
      admin: { findMany: jest.fn().mockResolvedValue([{ userId: 'AD-7', user: { name: 'Bola Tinubu-Ade' } }]) },
      user: { findUnique: jest.fn().mockResolvedValue({ name: 'Ops Admin', email: 'ops@example.com' }) },
    };
    const ledgerTx = { transaction: jest.fn(async (work: (t: typeof tx) => Promise<unknown>) => work(tx)) };
    const ledger = { importLoan: jest.fn().mockResolvedValue({}) };
    const periods = { firstUnsubmittedFrom: jest.fn().mockResolvedValue({ id: 'p-10', ...OCTOBER_2026 }) };
    const clock = { now: () => NOW };
    const settings = { requireRates: jest.fn().mockResolvedValue(RATES) };
    const commodities = { ensure: jest.fn().mockResolvedValue({ id: 'cm-1', name: 'Solar Panel' }) };
    const accounts = { createWithPassword: jest.fn(async (_tx: unknown, input: { id: string }) => ({ id: input.id })) };
    const inapp = { messageUser: jest.fn() };
    const mail = { sendCustomerImportSummary: jest.fn(), sendCustomerNotification: jest.fn() };
    const consumer = new ServicesConsumer(
      prisma as never,
      ledgerTx as never,
      ledger as never,
      periods as never,
      clock as never,
      settings as never,
      commodities as never,
      accounts as never,
      inapp as never,
      mail as never,
    );
    return { tx, prisma, ledgerTx, ledger, periods, settings, commodities, accounts, inapp, mail, consumer };
  }

  beforeEach(() => jest.clearAllMocks());

  it('imports each row in its own transaction: account, customer, payroll, bank details, loan', async () => {
    const { tx, ledgerTx, ledger, accounts, commodities, inapp, mail, consumer } = setup();
    const summary = await consumer.handleImport(
      job([cells(), cells({ IPPIS: 445566, 'PHONE NUMBER': '08050000000', 'AMOUNT/ITEM': 'Solar panel', BVN: '22200000001' })]),
    );

    // The asset row has no interest split by design: one note for all assets, not a per-row warning.
    expect(summary).toEqual({
      total: 2,
      imported: 2,
      failed: 0,
      skipped: 0,
      errors: [],
      warnings: [assetLoansNote(1)],
    });
    expect(ledgerTx.transaction).toHaveBeenCalledTimes(2);
    expect(accounts.createWithPassword).toHaveBeenCalledWith(tx, {
      id: expect.stringMatching(/^MB-/),
      type: 'CUSTOMER',
      name: 'Ada Obi',
      phoneNumber: '+2348031234567',
      phoneNumberVerified: false,
      emailVerified: false,
      status: 'ACTIVE',
      password: expect.stringMatching(/^.{32}$/),
    });
    const userId = accounts.createWithPassword.mock.calls[0][1].id;
    // "bola" from the MARKETER column is part of the officer's name.
    expect(tx.customer.create).toHaveBeenCalledWith({
      data: { userId, externalId: '112233', accountOfficerId: 'AD-7' },
    });
    expect(tx.customerPayroll.create).toHaveBeenCalledWith({
      data: { externalId: '112233', organization: 'Nigerian Army', command: 'HQ Lagos' },
    });
    expect(tx.customerPaymentMethod.create).toHaveBeenCalledWith({
      data: { userId, bankName: 'First Bank', accountNumber: '0123456789', accountName: 'Ada Obi', bvn: '22212345678' },
    });

    const [cash, cashTx] = ledger.importLoan.mock.calls[0] as [ImportLoan, unknown];
    expect(cashTx).toBe(tx);
    expect(cash).toMatchObject({ borrowerId: userId, category: 'PERSONAL', monthsLeft: 3, actorId: 'AD-1' });
    const [asset] = ledger.importLoan.mock.calls[1] as [ImportLoan];
    expect(asset).toMatchObject({ category: 'ASSET_PURCHASE', commodityId: 'cm-1' });
    expect(String(asset.principal)).toBe('590000');
    expect(commodities.ensure).toHaveBeenCalledWith('Solar panel');

    expect(inapp.messageUser).toHaveBeenCalledWith({
      userId: 'AD-1',
      title: 'Customer Import Complete',
      message: `Imported 2 of 2 customers; 0 failed.

Check these:
${assetLoansNote(1)}`,
      callToActionUrl: '/customers',
    });
    expect(mail.sendCustomerImportSummary).toHaveBeenCalledWith(
      'ops@example.com',
      expect.objectContaining({ name: 'Ops Admin', imported: 2, failed: 0, errors: [], moreErrors: 0 }),
    );
  });

  it('warns about a cash loan imported with no interest, but still imports it', async () => {
    const { ledger, consumer } = setup();
    const summary = await consumer.handleImport(
      job([cells({ TOTAL: 500000, 'AMOUNT PAID': 100000, 'OUTSTANDING BALANCE': 400000 })]),
    );

    expect(summary.imported).toBe(1);
    expect(ledger.importLoan).toHaveBeenCalledTimes(1);
    expect(summary.warnings).toEqual([
      expect.stringMatching(/^Row \d+ \(Ada Obi\): imported with no interest/),
    ]);
  });

  it('records a bad row and a duplicate, and carries on with the rest', async () => {
    const { ledgerTx, inapp, consumer } = setup();
    const duplicate = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6',
      meta: { target: ['bvn'] },
    });
    ledgerTx.transaction.mockImplementationOnce(async () => {
      throw duplicate;
    });

    const summary = await consumer.handleImport(
      job([
        cells({ NAME: 'Dup Customer', BVN: '22200000003' }),
        cells({ IPPIS: 778899, NAME: 'Bad Phone', 'PHONE NUMBER': '12345' }),
        cells({ IPPIS: 445566, 'PHONE NUMBER': '08050000000', BVN: '22200000001' }),
      ]),
    );

    expect(summary).toMatchObject({ total: 3, imported: 1, failed: 2 });
    expect(summary.errors).toEqual([
      'Row 3 (Dup Customer): BVN 22200000003 is already registered',
      'Row 4 (Bad Phone): PHONE NUMBER "12345" is not a Nigerian mobile number',
    ]);
    // Only rows that passed the checks reach the database.
    expect(ledgerTx.transaction).toHaveBeenCalledTimes(2);
    expect(inapp.messageUser).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Customer Import Finished With Errors',
        message: expect.stringContaining('Imported 1 of 3 customers; 2 failed.\n\nRow 3 (Dup Customer)'),
      }),
    );
    expect(captureJobError).not.toHaveBeenCalled();
  });

  it('reports an unexpected failure without showing its details to the uploader', async () => {
    const { ledger, consumer } = setup();
    ledger.importLoan.mockRejectedValueOnce(new Error('connection reset'));
    const summary = await consumer.handleImport(job([cells()]));
    expect(summary.errors).toEqual([
      'Row 3 (Ada Obi): Not saved because of an unexpected error; upload this row again later',
    ]);
    expect(captureJobError).toHaveBeenCalledWith(expect.any(Error), {
      queue: 'services',
      job: 'onboard_existing_customers',
      jobId: 'job-1',
    });
  });

  it('fails the job, before touching any row, until the rates are set', async () => {
    const { settings, ledgerTx, consumer } = setup();
    settings.requireRates.mockRejectedValue(new ConflictException('Set rates in Settings first'));
    await expect(consumer.handleImport(job([cells()]))).rejects.toThrow(
      'Set the interest and management fee rates in Settings before importing customers',
    );
    expect(ledgerTx.transaction).not.toHaveBeenCalled();
  });

  it('tells the uploader when the job fails, and reports it', async () => {
    const { inapp, mail, consumer } = setup();
    const failure = new Error('Set the interest and management fee rates in Settings before importing customers');
    await consumer.onFailed(job([]), failure);
    expect(captureJobError).toHaveBeenCalledWith(failure, {
      queue: 'services',
      job: 'onboard_existing_customers',
      jobId: 'job-1',
    });
    expect(inapp.messageUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'AD-1', title: 'Customer Import Failed' }),
    );
    expect(mail.sendCustomerNotification).toHaveBeenCalledWith(
      'ops@example.com',
      expect.objectContaining({ title: 'Customer Import Failed', message: expect.stringContaining(failure.message) }),
    );
  });
});
