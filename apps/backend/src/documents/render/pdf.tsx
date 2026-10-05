import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import { Document, Font, G, Page, Path, renderToBuffer, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import type { DocumentKind } from 'src/common/types/queue.interface';
import type { CustomerReportDto, ReportStatementLineDto } from '../customer-report.dto';
import { lagosDate, lagosDateTime, lagosTime } from '../spreadsheet';
import {
  balanceFields,
  customerBlock,
  documentTitle,
  forPdf,
  formatNaira,
  formatValue,
  historyTable,
  isNaira,
  loansTable,
  notesFields,
  revenueFields,
  statementBlock,
  statementFacts,
  statementReference,
  topupsTable,
  totalFields,
  type Field,
  type Table,
} from './content';
import { BRAND, LOGO_FILLS, LOGO_STROKES, LOGO_VIEWBOX } from './logo';

// The statement and report as PDFs (@react-pdf/renderer), laid out like a bank statement: the logo
// and title, who it's for and what it covers, the balance sum, then the transactions under a
// header that repeats on every page. Noto Sans has the ₦ glyph; if its files can't be found the
// built-in Helvetica is used and amounts read "NGN" instead.

interface Fonts {
  family: string;
  symbol: string;
}

let fonts: Fonts | undefined;

function fontDir(): string | undefined {
  const candidates = [
    path.join(__dirname, '..', '..', 'common', 'fonts'),
    path.join(process.cwd(), 'src', 'common', 'fonts'),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'NotoSans-Regular.ttf')));
}

function loadFonts(): Fonts {
  if (fonts) return fonts;
  const dir = fontDir();
  if (dir) {
    Font.register({
      family: 'NotoSans',
      fonts: [
        { src: path.join(dir, 'NotoSans-Regular.ttf') },
        { src: path.join(dir, 'NotoSans-Bold.ttf'), fontWeight: 'bold' },
      ],
    });
    fonts = { family: 'NotoSans', symbol: '₦' };
  } else {
    fonts = { family: 'Helvetica', symbol: 'NGN ' };
  }
  // IDs and amounts must never be hyphenated across lines.
  Font.registerHyphenationCallback((word) => [word]);
  return fonts;
}

const SUPPORT = 'microbuiltprime.com/support';
const INK = '#1a1a1a';
const MUTED = '#6b6b6b';
const LINE = '#e4e1e1';
const TINT = '#f7f2f2';
const ZEBRA = '#fbf9f9';

const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 58, paddingHorizontal: 32, fontSize: 8.5, color: INK },
  // Header
  masthead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  titleBlock: { alignItems: 'flex-end' },
  title: { fontSize: 15, fontWeight: 'bold', color: BRAND, letterSpacing: 1 },
  subtitle: { fontSize: 8, color: MUTED, marginTop: 2 },
  rule: { borderBottomWidth: 2, borderBottomColor: BRAND, marginTop: 8, marginBottom: 12 },
  // Who / what
  parties: { flexDirection: 'row', marginBottom: 12 },
  party: { flex: 1.15, paddingRight: 16 },
  partyName: { fontSize: 12, fontWeight: 'bold' },
  address: { color: MUTED, marginTop: 2, marginBottom: 6 },
  panel: { flex: 1, backgroundColor: TINT, borderRadius: 4, padding: 8 },
  kv: { flexDirection: 'row', paddingVertical: 1.5 },
  kvLabel: { width: 78, color: MUTED },
  kvValue: { flex: 1, fontWeight: 'bold' },
  // Balance sum
  sum: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  tile: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8 },
  tileStrong: { backgroundColor: BRAND, borderColor: BRAND },
  tileLabel: { fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  tileValue: { fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  operator: { width: 16, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: MUTED },
  facts: { flexDirection: 'row', marginBottom: 14 },
  fact: { flex: 1, flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: LINE },
  factLabel: { color: MUTED, marginRight: 4 },
  factValue: { fontWeight: 'bold' },
  // Sections and tables
  section: { marginBottom: 12 },
  heading: { fontSize: 10, fontWeight: 'bold', color: BRAND, marginBottom: 5 },
  fields: { flexDirection: 'row', flexWrap: 'wrap' },
  field: { width: '50%', flexDirection: 'row', paddingVertical: 1.5 },
  label: { width: '40%', color: MUTED },
  value: { width: '60%', fontWeight: 'bold' },
  table: { borderTopWidth: 1, borderColor: LINE },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: LINE },
  headRow: { backgroundColor: BRAND, borderColor: BRAND },
  zebra: { backgroundColor: ZEBRA },
  cell: { paddingVertical: 3.5, paddingHorizontal: 4 },
  headCell: { fontWeight: 'bold', color: '#ffffff' },
  right: { textAlign: 'right' },
  muted: { color: MUTED },
  small: { fontSize: 6.5, color: MUTED, marginTop: 1 },
  // Footer
  footer: { position: 'absolute', bottom: 18, left: 32, right: 32, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 5 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.5, color: MUTED },
});

function Logo({ height }: { height: number }) {
  const [, , w, h] = LOGO_VIEWBOX.split(' ').map(Number);
  return (
    <Svg viewBox={LOGO_VIEWBOX} style={{ height, width: (height * w) / h }}>
      <G>
        {LOGO_STROKES.map((stroke) => (
          <Path key={stroke.d} d={stroke.d} fill="none" stroke={BRAND} strokeWidth={stroke.width} strokeLinejoin="round" />
        ))}
        {LOGO_FILLS.map((d) => (
          <Path key={d} d={d} fill={BRAND} />
        ))}
      </G>
    </Svg>
  );
}

function Masthead({ kind, data }: { kind: DocumentKind; data: CustomerReportDto }) {
  const copy = data.audience === 'admin' ? 'Internal copy' : 'Customer copy';
  return (
    <View>
      <View style={styles.masthead}>
        <Logo height={26} />
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{documentTitle(kind).toUpperCase()}</Text>
          <Text style={styles.subtitle}>
            {copy} · Generated {lagosDateTime(data.generatedAt)}
          </Text>
        </View>
      </View>
      <View style={styles.rule} />
    </View>
  );
}

function KeyValues({ list, symbol }: { list: Field[]; symbol: string }) {
  return (
    <View>
      {list.map((field) => (
        <View key={field.label} style={styles.kv} wrap={false}>
          <Text style={styles.kvLabel}>{field.label}</Text>
          <Text style={styles.kvValue}>{formatValue(field.value, symbol) || '—'}</Text>
        </View>
      ))}
    </View>
  );
}

/** Whose statement it is (left) and what it covers (right). */
function Parties({ data, symbol }: { data: CustomerReportDto; symbol: string }) {
  return (
    <View style={styles.parties} wrap={false}>
      <View style={styles.party}>
        <Text style={styles.partyName}>{data.customer.name.toUpperCase()}</Text>
        <Text style={styles.address}>{data.customer.address ?? ' '}</Text>
        <KeyValues list={customerBlock(data)} symbol={symbol} />
      </View>
      <View style={styles.panel}>
        <KeyValues list={statementBlock(data)} symbol={symbol} />
      </View>
    </View>
  );
}

/** Opening + debits − credits = closing, as four tiles, then the running loan's monthly figures. */
function BalanceSum({ data, symbol }: { data: CustomerReportDto; symbol: string }) {
  const s = data.statement;
  const tile = (label: string, amount: number, strong = false) => (
    <View style={strong ? [styles.tile, styles.tileStrong] : styles.tile}>
      <Text style={strong ? [styles.tileLabel, { color: '#f3dede' }] : styles.tileLabel}>{label}</Text>
      <Text style={strong ? [styles.tileValue, { color: '#ffffff' }] : styles.tileValue}>
        {formatNaira(amount, symbol)}
      </Text>
    </View>
  );
  return (
    <View wrap={false}>
      <View style={styles.sum}>
        {tile('Opening balance', s.opening)}
        <Text style={styles.operator}>+</Text>
        {tile('Debits', s.debits)}
        <Text style={styles.operator}>−</Text>
        {tile('Credits', s.credits)}
        <Text style={styles.operator}>=</Text>
        {tile('Closing balance', s.closing, true)}
      </View>
      <View style={styles.facts}>
        {statementFacts(data).map((fact) => (
          <View key={fact.label} style={styles.fact}>
            <Text style={styles.factLabel}>{fact.label}</Text>
            <Text style={styles.factValue}>{formatValue(fact.value, symbol)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface LineColumn {
  label: string;
  weight: number;
  amount?: boolean;
  render: (line: ReportStatementLineDto) => React.ReactNode;
}

function statementColumns(data: CustomerReportDto, symbol: string): LineColumn[] {
  const amount = (value: number | undefined) => (value ? formatNaira(value, symbol) : '');
  const admin = data.audience === 'admin';
  return [
    {
      label: 'Date',
      weight: 0.85,
      render: (line) => (
        <>
          <Text>{lagosDate(line.date)}</Text>
          <Text style={styles.small}>{lagosTime(line.date)}</Text>
        </>
      ),
    },
    {
      label: 'Description',
      weight: admin ? 2.4 : 2.9,
      render: (line) => (
        <>
          <Text>{line.description}</Text>
          <Text style={styles.small}>
            {line.loanId} · Ref {line.reference}
          </Text>
        </>
      ),
    },
    { label: 'Debit', weight: 1, amount: true, render: (line) => <Text>{amount(line.debit)}</Text> },
    { label: 'Credit', weight: 1, amount: true, render: (line) => <Text>{amount(line.credit)}</Text> },
    {
      label: 'Balance',
      weight: 1.05,
      amount: true,
      render: (line) => <Text style={{ fontWeight: 'bold' }}>{formatNaira(line.balance, symbol)}</Text>,
    },
    ...(admin
      ? ([
          { label: 'Mgmt fee', weight: 0.85, amount: true, render: (line) => <Text>{amount(line.managementFee)}</Text> },
          { label: 'Principal', weight: 0.85, amount: true, render: (line) => <Text>{amount(line.split?.principal)}</Text> },
          { label: 'Interest', weight: 0.85, amount: true, render: (line) => <Text>{amount(line.split?.interest)}</Text> },
          { label: 'Penalty', weight: 0.85, amount: true, render: (line) => <Text>{amount(line.split?.penalty)}</Text> },
        ] satisfies LineColumn[])
      : []),
  ];
}

/** Every line of the range; the column header repeats at the top of each page. */
function Transactions({ data, symbol }: { data: CustomerReportDto; symbol: string }) {
  const columns = statementColumns(data, symbol);
  const total = columns.reduce((sum, column) => sum + column.weight, 0);
  const width = (column: LineColumn) => `${(column.weight / total) * 100}%`;
  const lines = data.statement.lines;
  return (
    <View style={styles.section}>
      <Text style={styles.heading} minPresenceAhead={60}>
        Transactions
      </Text>
      {lines.length === 0 ? (
        <Text style={styles.muted}>Nothing was booked or paid in this period.</Text>
      ) : (
        <View style={[styles.table, { fontSize: data.audience === 'admin' ? 7 : 7.8 }]}>
          <View style={[styles.row, styles.headRow]} fixed>
            {columns.map((column) => (
              <Text
                key={column.label}
                style={[styles.cell, styles.headCell, { width: width(column) }, column.amount ? styles.right : {}]}
              >
                {column.label}
              </Text>
            ))}
          </View>
          {lines.map((line, index) => (
            <View key={index} style={index % 2 ? [styles.row, styles.zebra] : styles.row} wrap={false}>
              {columns.map((column) => (
                <View key={column.label} style={[styles.cell, { width: width(column) }, column.amount ? styles.right : {}]}>
                  {column.render(line)}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Fields({ list, symbol }: { list: Field[]; symbol: string }) {
  return (
    <View style={styles.fields}>
      {list.map((field) => (
        <View key={field.label} style={styles.field} wrap={false}>
          <Text style={styles.label}>{field.label}</Text>
          <Text style={styles.value}>{formatValue(field.value, symbol) || '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function Section({ title, children, breakBefore }: { title: string; children: React.ReactNode; breakBefore?: boolean }) {
  return (
    <View style={styles.section} break={breakBefore}>
      <Text style={styles.heading} minPresenceAhead={40}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function TableView({ table, symbol, fontSize }: { table: Table; symbol: string; fontSize: number }) {
  const t = forPdf(table);
  if (t.rows.length === 0) return <Text style={styles.muted}>{t.empty}</Text>;
  const total = t.columns.reduce((sum, column) => sum + column.weight, 0);
  const width = t.columns.map((column) => `${(column.weight / total) * 100}%`);
  const numeric = t.columns.map((_, index) => t.rows.some((row) => isNaira(row[index])));
  return (
    <View style={[styles.table, { fontSize }]}>
      <View style={[styles.row, styles.headRow]} fixed>
        {t.columns.map((column, index) => (
          <Text
            key={column.label}
            style={[styles.cell, styles.headCell, { width: width[index] }, numeric[index] ? styles.right : {}]}
          >
            {column.label}
          </Text>
        ))}
      </View>
      {t.rows.map((row, rowIndex) => (
        <View key={rowIndex} style={rowIndex % 2 ? [styles.row, styles.zebra] : styles.row} wrap={false}>
          {row.map((value, index) => (
            <Text key={index} style={[styles.cell, { width: width[index] }, numeric[index] ? styles.right : {}]}>
              {formatValue(value, symbol)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Footer({ data }: { data: CustomerReportDto }) {
  return (
    <View style={styles.footer} fixed>
      <View style={styles.footerRow}>
        <Text>MicroBuilt Prime · {SUPPORT}</Text>
        <Text>Reference {statementReference(data)}</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
      <Text style={[styles.footerRow, { marginTop: 2 }]}>
        This statement is computer-generated and needs no signature. Amounts are in naira; a debit adds to what is
        owed and a credit is a repayment. Report anything you don’t recognise through {SUPPORT}.
      </Text>
    </View>
  );
}

function statementDocument(data: CustomerReportDto, f: Fonts) {
  const admin = data.audience === 'admin';
  return (
    <Document
      title={`MicroBuilt Prime statement — ${data.customer.name}`}
      author="MicroBuilt Prime"
      creator="MicroBuilt Prime"
      subject={statementReference(data)}
    >
      <Page size="A4" orientation={admin ? 'landscape' : 'portrait'} style={[styles.page, { fontFamily: f.family }]}>
        <Masthead kind="statement" data={data} />
        <Parties data={data} symbol={f.symbol} />
        <BalanceSum data={data} symbol={f.symbol} />
        <Transactions data={data} symbol={f.symbol} />
        <Footer data={data} />
      </Page>
    </Document>
  );
}

function reportDocument(data: CustomerReportDto, f: Fonts) {
  const admin = data.audience === 'admin';
  const topups = topupsTable(data);
  const history = historyTable(data);
  const revenue = revenueFields(data);
  return (
    <Document
      title={`MicroBuilt Prime loan report — ${data.customer.name}`}
      author="MicroBuilt Prime"
      creator="MicroBuilt Prime"
      subject={statementReference(data)}
    >
      <Page size="A4" orientation={admin ? 'landscape' : 'portrait'} style={[styles.page, { fontFamily: f.family }]}>
        <Masthead kind="report" data={data} />
        <Parties data={data} symbol={f.symbol} />
        <Section title="Totals">
          <Fields list={[...totalFields(data), ...balanceFields(data)]} symbol={f.symbol} />
        </Section>
        {revenue.length > 0 && (
          <Section title="Revenue in the period">
            <Fields list={revenue} symbol={f.symbol} />
          </Section>
        )}
        <Section title="Loans">
          <TableView table={loansTable(data)} symbol={f.symbol} fontSize={7.5} />
        </Section>
        {topups.rows.length > 0 && (
          <Section title="Top-ups">
            <TableView table={topups} symbol={f.symbol} fontSize={7.5} />
          </Section>
        )}
        {history && (
          <Section title="Internal notes">
            <Fields list={notesFields(data)} symbol={f.symbol} />
            <View style={{ marginTop: 6 }}>
              <TableView table={history} symbol={f.symbol} fontSize={7.5} />
            </View>
          </Section>
        )}
        <View break>
          <BalanceSum data={data} symbol={f.symbol} />
          <Transactions data={data} symbol={f.symbol} />
        </View>
        <Footer data={data} />
      </Page>
    </Document>
  );
}

/** The statement: who and what, the balance sum, and every line of the range. */
export function renderStatementPdf(data: CustomerReportDto): Promise<Buffer> {
  return renderToBuffer(statementDocument(data, loadFonts()));
}

/** The report: customer, totals, loans and top-ups (admins: revenue and notes), then the statement. */
export function renderReportPdf(data: CustomerReportDto): Promise<Buffer> {
  return renderToBuffer(reportDocument(data, loadFonts()));
}
