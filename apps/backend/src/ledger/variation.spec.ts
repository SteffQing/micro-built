import * as XLSX from 'xlsx';
import { money } from './money';
import {
  buildVariationWorkbook,
  classifyVariation,
  variationDates,
  VARIATION_COLUMNS,
  VARIATION_SHEET,
  type VariationRow,
} from './variation';

describe('classifyVariation', () => {
  it('starts a loan payroll has never been sent', () => {
    expect(classifyVariation(money('22666.67'), null)).toBe('START');
    expect(classifyVariation(money(0), null)).toBeNull();
  });

  it('amends a changed amount and leaves an unchanged one out of the file', () => {
    expect(classifyVariation(money('25453.33'), money('22666.67'))).toBe('AMEND');
    expect(classifyVariation(money('22666.67'), money('22666.67'))).toBeNull();
  });

  it('stops a loan with nothing left to deduct', () => {
    expect(classifyVariation(money(0), money('17433.33'))).toBe('STOP');
    expect(classifyVariation(money(0), money(0))).toBeNull();
  });

  it('starts afresh a stopped loan that owes again', () => {
    expect(classifyVariation(money(5000), money(0))).toBe('START');
  });
});

describe('variationDates', () => {
  it('runs from the 1st of the period to the end of the last month to deduct', () => {
    expect(variationDates({ year: 2026, month: 'JUNE' }, 6)).toEqual({ start: '01/06/2026', end: '30/11/2026' });
    expect(variationDates({ year: 2026, month: 'JUNE' }, 1)).toEqual({ start: '01/06/2026', end: '30/06/2026' });
  });

  it('crosses the year end and knows February', () => {
    expect(variationDates({ year: 2026, month: 'DECEMBER' }, 3)).toEqual({ start: '01/12/2026', end: '28/02/2027' });
    expect(variationDates({ year: 2028, month: 'JANUARY' }, 2)).toEqual({ start: '01/01/2028', end: '29/02/2028' });
  });

  it('ends a STOP where it starts', () => {
    expect(variationDates({ year: 2026, month: 'APRIL' }, 0)).toEqual({ start: '01/04/2026', end: '01/04/2026' });
  });
});

describe('buildVariationWorkbook', () => {
  const row = (overrides: Partial<VariationRow> = {}): VariationRow => ({
    loanId: 'LN-1',
    customerId: 'MB-1',
    externalId: '123456',
    name: 'Ada Obi',
    command: 'LAGOS',
    balance: money('113333.33'),
    amount: money('22666.67'),
    tenure: 5,
    action: 'AMEND',
    reasons: [],
    start: '01/02/2026',
    end: '30/06/2026',
    ...overrides,
  });
  const readRows = (file: Buffer) => {
    const book = XLSX.read(file, { type: 'buffer' });
    return {
      sheets: book.SheetNames,
      rows: XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[VARIATION_SHEET], { header: 1, defval: '' }),
    };
  };

  it('has exactly the nine columns payroll expects, on a "Payroll changes" sheet', () => {
    const stop = row({ name: 'Bola Ade', externalId: '654321', balance: money(0), amount: money(0), tenure: 0, action: 'STOP', start: '01/02/2026', end: '01/02/2026' });
    const { sheets, rows } = readRows(buildVariationWorkbook([row(), stop]));
    expect(sheets).toEqual([VARIATION_SHEET]);
    expect(rows[0]).toEqual([...VARIATION_COLUMNS]);
    expect(rows[1]).toEqual([1, '123456', 'Ada Obi', 'LAGOS', 113333.33, 22666.67, 5, '01/02/2026', '30/06/2026']);
    expect(rows[2]).toEqual([2, '654321', 'Bola Ade', 'LAGOS', 0, 0, 0, '01/02/2026', '01/02/2026']);
  });

  it('leaves unknown IPPIS numbers and commands blank', () => {
    const { rows } = readRows(buildVariationWorkbook([row({ externalId: null, command: null })]));
    expect(rows[1][1]).toBe('');
    expect(rows[1][3]).toBe('');
  });

  it('still writes the header row when nothing changed', () => {
    const { rows } = readRows(buildVariationWorkbook([]));
    expect(rows).toEqual([[...VARIATION_COLUMNS]]);
  });
});
