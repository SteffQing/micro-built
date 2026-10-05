import { execFileSync } from 'child_process';
import * as path from 'path';
import * as XLSX from 'xlsx';
import type { CustomerReportDto } from '../customer-report.dto';
import { NAIRA_FORMAT } from '../spreadsheet';
import { formatNaira } from './content';
import { renderReportXlsx, renderStatementXlsx } from './xlsx';

const fixture: CustomerReportDto = {
  audience: 'admin',
  generatedAt: new Date('2026-10-01T09:00:00Z'),
  range: { from: '2026-06', to: '2026-10', fromLabel: 'JUNE 2026', toLabel: 'OCTOBER 2026' },
  customer: {
    id: 'MB-1',
    name: 'Ada Obi',
    externalId: '001234',
    phoneNumber: '+2348012345678',
    email: null,
    organization: 'NIGERIAN NAVY',
    command: 'LAGOS',
    address: '12 Marina Road, Lagos',
    status: 'ACTIVE',
  },
  loans: [
    {
      id: 'LN-1',
      status: 'DISBURSED',
      category: 'ASSET_PURCHASE',
      disbursementDate: new Date('2026-06-10T10:00:00Z'),
      owed: 120_000,
      repaid: 20_000,
      outstanding: 100_000,
      principal: 100_000,
      interestBooked: 20_000,
      penaltyBooked: 0,
      tenure: 6,
      remainingMonths: 5,
      monthly: 20_000,
      commodity: { name: 'Laptop', details: 'HP EliteBook', privateDetails: 'Invoice 4411' },
      topups: [
        {
          id: 'ML-T1',
          amount: 50_000,
          status: 'DISBURSED',
          requestedAt: new Date('2026-08-01T10:00:00Z'),
          disbursedAt: new Date('2026-08-02T10:00:00Z'),
          commodity: null,
        },
      ],
    },
  ],
  statement: {
    opening: 0,
    debits: 120_000,
    credits: 20_000,
    closing: 100_000,
    lines: [
      {
        date: new Date('2026-06-10T10:00:00Z'),
        loanId: 'LN-1',
        reference: 'ML-1',
        type: 'DISBURSEMENT',
        description: 'Loan disbursed',
        debit: 100_000,
        credit: 0,
        balance: 100_000,
        managementFee: 2_000,
      },
      {
        date: new Date('2026-07-28T10:00:00Z'),
        loanId: 'LN-1',
        reference: 'RP-1',
        type: 'REPAYMENT',
        description: 'Payroll deduction, JULY 2026',
        debit: 0,
        credit: 20_000,
        balance: 80_000,
        split: { principal: 15_000, interest: 5_000, penalty: 0 },
      },
    ],
  },
  totals: { repaid: 20_000, outstanding: 100_000, repaymentRate: 87.5 },
  revenue: { interestBooked: 20_000, interestCollected: 5_000, managementFee: 2_000, penaltyCharged: 0, penaltyCollected: 0 },
  accountOfficer: { id: 'AD-1', name: 'Jane Admin' },
  notes: {
    flagReason: null,
    history: [{ action: 'LOAN_DISBURSED', note: 'First loan', actorName: 'Jane Admin', createdAt: new Date('2026-06-10T10:00:00Z') }],
  },
};

/** The same data as a customer receives it (StatementService already strips their lines). */
const customerCopy: CustomerReportDto = {
  audience: 'customer',
  generatedAt: fixture.generatedAt,
  range: fixture.range,
  customer: fixture.customer,
  loans: fixture.loans.map((loan) => ({ ...loan, commodity: { name: 'Laptop', details: 'HP EliteBook' } })),
  statement: {
    ...fixture.statement,
    lines: fixture.statement.lines.map((line) => ({
      date: line.date,
      loanId: line.loanId,
      reference: line.reference,
      type: line.type,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      balance: line.balance,
    })),
  },
  totals: fixture.totals,
};

function sheets(body: Buffer): Record<string, unknown[][]> {
  const book = XLSX.read(body, { type: 'buffer' });
  return Object.fromEntries(
    book.SheetNames.map((name) => [
      name,
      XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], { header: 1, defval: '' }),
    ]),
  );
}

describe('formatNaira', () => {
  it('writes ₦ with thousands separators and 2 decimals', () => {
    expect(formatNaira(1234567.5)).toBe('₦1,234,567.50');
    expect(formatNaira(0)).toBe('₦0.00');
    expect(formatNaira(-20)).toBe('-₦20.00');
    expect(formatNaira(5, 'NGN ')).toBe('NGN 5.00');
  });
});

describe('XLSX', () => {
  it('lays out the statement under a header, with naira-formatted numbers', () => {
    const body = renderStatementXlsx(fixture);
    const { Statement: grid } = sheets(body);
    expect(grid[0][0]).toBe('MicroBuilt Prime — Customer statement');
    expect(grid[1][0]).toBe('Internal copy · Generated 01/10/2026 10:00 WAT');
    expect(grid[3][0]).toBe('ADA OBI');
    const pairs = grid.map((row) => row.slice(0, 2));
    expect(pairs).toContainEqual(['Customer ID', 'MB-1']);
    expect(pairs).toContainEqual(['IPPIS number', '001234']);
    expect(pairs).toContainEqual(['Period', 'JUNE 2026 – OCTOBER 2026']);
    expect(pairs).toContainEqual(['Reference', 'ST-MB1-202610011000']);
    expect(pairs).toContainEqual(['Monthly deduction', 20_000]);
    const header = grid.find((row) => row[0] === 'Date')!;
    expect(header).toContain('Management Fee');
    const repayment = grid.find((row) => row[2] === 'RP-1')!;
    expect(repayment[header.indexOf('Credit')]).toBe(20_000);
    expect(repayment[header.indexOf('Principal Paid')]).toBe(15_000);

    const sheet = XLSX.read(body, { type: 'buffer', cellNF: true }).Sheets.Statement;
    const closing = Object.values(sheet).find((cell: XLSX.CellObject) => cell?.v === 100_000) as XLSX.CellObject;
    expect(closing.z).toBe(NAIRA_FORMAT);
  });

  it("keeps the admin columns out of a customer's statement", () => {
    const { Statement: grid } = sheets(renderStatementXlsx(customerCopy));
    const header = grid.find((row) => row[0] === 'Date')!;
    expect(header).not.toContain('Management Fee');
    expect(header).not.toContain('Principal Paid');
  });

  it('makes the report a Summary sheet and a Statement sheet', () => {
    const admin = sheets(renderReportXlsx(fixture));
    expect(Object.keys(admin)).toEqual(['Summary', 'Statement']);
    const summary = admin.Summary.map((row) => row.filter((cell) => cell !== ''));
    expect(summary).toContainEqual(['Account officer', 'Jane Admin']);
    expect(summary).toContainEqual(['Interest collected', 5_000]);
    expect(summary).toContainEqual(['Repayment rate', '87.5%']);
    expect(summary.flat()).toContain('Invoice 4411');
    expect(summary.flat()).toContain('First loan');

    const customer = sheets(renderReportXlsx(customerCopy));
    const flat = customer.Summary.flat();
    for (const adminOnly of ['Account officer', 'Revenue in the period', 'Internal notes', 'Private Details', 'Invoice 4411']) {
      expect(flat).not.toContain(adminOnly);
    }
    expect(flat).toContain('Laptop');
  });
});

// @react-pdf/renderer is ESM-only and Jest (CommonJS) can't parse it, while Node itself loads it
// with require(). So the PDFs are rendered by a child Node process, the way the app runs them.
describe('PDF', () => {
  const backendRoot = path.resolve(__dirname, '..', '..', '..');
  const script = `
    const pdf = require('./src/documents/render/pdf');
    const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    Promise.all([
      pdf.renderStatementPdf(data.admin),
      pdf.renderReportPdf(data.admin),
      pdf.renderStatementPdf(data.customer),
      pdf.renderReportPdf(data.customer),
    ]).then((files) => process.stdout.write(JSON.stringify(files.map((f) => f.subarray(0, 4).toString('latin1')))));
  `;

  it('renders the statement and the report for both audiences', () => {
    const out = execFileSync(
      process.execPath,
      ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', '-e', script],
      {
        cwd: backendRoot,
        input: JSON.stringify({ admin: fixture, customer: customerCopy }),
        env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true', TS_NODE_PROJECT: 'tsconfig.json' },
        encoding: 'utf8',
        timeout: 90_000,
      },
    );
    expect(JSON.parse(out)).toEqual(['%PDF', '%PDF', '%PDF', '%PDF']);
  }, 120_000);
});
