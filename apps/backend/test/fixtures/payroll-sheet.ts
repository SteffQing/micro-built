// A government payroll return as the upload expects it (src/common/logic/repayment-validation.ts):
// one sheet, header on the first row, one row per employee. Required columns are STAFF ID, AMOUNT,
// FULL NAME, PERIOD and an organization column (MDA here); COMMAND, GRADE, STEP, EMPLOYEE GROSS and
// NET PAY update the customer's payroll record when filled in. PERIOD is written as a label
// ("OCTOBER 2026"), one of the forms `periodFromPayrollCell` reads.
//
// Used by scripts/smoke-v2.ts; it builds the workbook in memory, so no binary fixture is committed.
import { periodLabel, type Period } from '@microbuilt/shared';
import * as XLSX from 'xlsx';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface PayrollFixtureRow {
  /** The IPPIS number, matched against Customer.externalId. */
  staffId: string;
  fullName: string;
  /** Naira deducted this month. */
  amount: number;
  organization?: string;
  command?: string;
  grade?: string;
  step?: number;
  employeeGross?: number;
  netPay?: number;
}

const HEADER = [
  'S/N',
  'STAFF ID',
  'FULL NAME',
  'MDA',
  'COMMAND',
  'GRADE',
  'STEP',
  'EMPLOYEE GROSS',
  'NET PAY',
  'AMOUNT',
  'PERIOD',
] as const;

/** The rows of `period` as an .xlsx file. */
export function payrollSheet(period: Period, rows: PayrollFixtureRow[]): Buffer {
  const label = periodLabel(period);
  const data: (string | number)[][] = [
    [...HEADER],
    ...rows.map((row, index) => [
      index + 1,
      row.staffId,
      row.fullName,
      row.organization ?? 'Smoke Test Organization',
      row.command ?? 'Smoke Test Command',
      row.grade ?? '',
      row.step ?? '',
      row.employeeGross ?? '',
      row.netPay ?? '',
      row.amount,
      label,
    ]),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), 'Payroll');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
