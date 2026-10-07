import { monthNumber, toYm, type Period } from '@microbuilt/shared';
import * as XLSX from 'xlsx';
import type { Money } from './money';

// The monthly variation file an organization's payroll receives (PLAN_V2 R2/R3): only loans whose
// deduction changes, in exactly the nine columns payroll has always had. A month where nothing changed
// still gets a file, with the header row alone (P6). Kept pure so the file is testable.

export type VariationAction = 'START' | 'AMEND' | 'STOP';
export type VariationReason = 'NEW_LOAN' | 'TOPUP' | 'LIQUIDATION' | 'TENURE_CHANGE' | 'DEFAULT';

export const VARIATION_SHEET = 'Payroll changes';
export const VARIATION_COLUMNS = [
  'S/NO',
  'IPPIS NO.',
  'NAMES OF BENEFICIARIES',
  'COMMAND',
  'LOAN BALANCE',
  'AMOUNT',
  'TENURE',
  'START DATE',
  'END DATE',
] as const;
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Where one generated version of an organization's variation is stored in the private variations
 * bucket (PLAN_V2 P4). Every generation writes a new version; superseded ones go when it locks.
 */
export function variationFilePath(organizationId: string, period: Period, version: number): string {
  return `${organizationId}/${toYm(period)}/v${version}.xlsx`;
}

/** The name a downloaded variation file is saved under: `variation-npf-2026-10-v2.xlsx`. */
export function variationFileName(organizationName: string, period: Period, version: number): string {
  const slug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'organization';
  return `variation-${slug}-${toYm(period)}-v${version}.xlsx`;
}

export interface VariationRow {
  loanId: string;
  customerId: string;
  /** IPPIS number; null when the customer has none on file (payroll can't act on the row). */
  externalId: string | null;
  name: string;
  command: string | null;
  /** Outstanding on the loan. */
  balance: Money;
  /** The new monthly deduction (0 = stop). */
  amount: Money;
  /** Months left to deduct (0 on a STOP). */
  tenure: number;
  action: VariationAction;
  /** What changed since payroll was last sent an amount, for the admins' filter. */
  reasons: VariationReason[];
  /** dd/MM/yyyy */
  start: string;
  end: string;
}

/**
 * What payroll must be told this month, comparing the OPEN amount with the last one it was sent
 * (`prior`; null if never). null = nothing changed, so the loan stays out of the file. A loan
 * that was stopped (last sent 0) and owes again starts afresh.
 */
export function classifyVariation(open: Money, prior: Money | null): VariationAction | null {
  if (prior === null || prior.isZero()) return open.isZero() ? null : 'START';
  if (open.equals(prior)) return null;
  return open.isZero() ? 'STOP' : 'AMEND';
}

/**
 * The 1st of the period to the last day of the month `months − 1` later, as dd/MM/yyyy (a
 * payroll month is a calendar month in Lagos). A STOP (0 months) ends where it starts.
 */
export function variationDates(period: Period, months: number): { start: string; end: string } {
  const monthIndex = monthNumber(period.month) - 1;
  const start = new Date(Date.UTC(period.year, monthIndex, 1));
  const end = months > 0 ? new Date(Date.UTC(period.year, monthIndex + months, 0)) : start;
  return { start: ddmmyyyy(start), end: ddmmyyyy(end) };
}

function ddmmyyyy(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

export function buildVariationWorkbook(rows: VariationRow[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((row, index) => ({
      'S/NO': index + 1,
      'IPPIS NO.': row.externalId ?? '',
      'NAMES OF BENEFICIARIES': row.name,
      COMMAND: row.command ?? '',
      'LOAN BALANCE': row.balance.toNumber(),
      AMOUNT: row.amount.toNumber(),
      TENURE: row.tenure,
      'START DATE': row.start,
      'END DATE': row.end,
    })),
    { header: [...VARIATION_COLUMNS] },
  );
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, VARIATION_SHEET);
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
