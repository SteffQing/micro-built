import type { CustomerReportDto } from '../customer-report.dto';
import { nairaCell, sheetsWorkbook, type GridCell } from '../spreadsheet';
import {
  balanceFields,
  customerFields,
  documentTitle,
  headerFields,
  historyTable,
  isNaira,
  loansTable,
  notesFields,
  revenueFields,
  statementTable,
  topupsTable,
  totalFields,
  type Field,
  type ReportValue,
  type Table,
} from './content';
import type { DocumentKind } from 'src/common/types/queue.interface';

// The statement and report as workbooks. Amounts stay numbers with a ₦ format, so they add up.

const cell = (value: ReportValue): GridCell => (isNaira(value) ? nairaCell(value.naira) : value);

function header(kind: DocumentKind, data: CustomerReportDto): GridCell[][] {
  return [[`MicroBuilt — ${documentTitle(kind)}`], ...fields(headerFields(data))];
}

function fields(list: Field[]): GridCell[][] {
  return list.map((field) => [field.label, cell(field.value)]);
}

function section(title: string, list: Field[]): GridCell[][] {
  return list.length ? [[], [title], ...fields(list)] : [];
}

function table(t: Table, withTitle = true): GridCell[][] {
  return [
    ...(withTitle ? [[], [t.title]] : [[]]),
    t.columns.map((column) => column.label),
    ...(t.rows.length ? t.rows.map((row) => row.map(cell)) : [[t.empty]]),
  ];
}

function statementGrid(data: CustomerReportDto): GridCell[][] {
  return [...header('statement', data), [], ...fields(balanceFields(data)), ...table(statementTable(data), false)];
}

/** One sheet: the header, the balances, then every line. */
export function renderStatementXlsx(data: CustomerReportDto): Buffer {
  return sheetsWorkbook([{ name: 'Statement', grid: statementGrid(data) }]);
}

/** A Summary sheet (customer, totals, loans, top-ups; for admins revenue and notes) and the Statement sheet. */
export function renderReportXlsx(data: CustomerReportDto): Buffer {
  const history = historyTable(data);
  const summary: GridCell[][] = [
    ...header('report', data),
    ...section('Customer', customerFields(data)),
    ...section('Totals', [...totalFields(data), ...balanceFields(data)]),
    ...section('Revenue in the period', revenueFields(data)),
    ...table(loansTable(data)),
    ...table(topupsTable(data)),
    ...(history ? [...section('Internal notes', notesFields(data)), ...table({ ...history, title: 'History' })] : []),
  ];
  return sheetsWorkbook([
    { name: 'Summary', grid: summary },
    { name: 'Statement', grid: statementGrid(data) },
  ]);
}
