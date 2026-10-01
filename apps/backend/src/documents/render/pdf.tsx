import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { DocumentKind } from 'src/common/types/queue.interface';
import type { CustomerReportDto } from '../customer-report.dto';
import {
  balanceFields,
  customerFields,
  documentTitle,
  forPdf,
  formatValue,
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
  type Table,
} from './content';

// The statement and report as PDFs (@react-pdf/renderer). Noto Sans has the ₦ glyph; if its files
// can't be found the built-in Helvetica is used and amounts read "NGN" instead.

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

const BORDER = '#dddddd';

const styles = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 48, paddingHorizontal: 32, fontSize: 9, color: '#111111' },
  brand: { fontSize: 18, fontWeight: 'bold' },
  title: { fontSize: 13, fontWeight: 'bold', color: '#333333', marginTop: 2 },
  rule: { borderBottomWidth: 2, borderBottomColor: '#000000', marginTop: 6, marginBottom: 10 },
  section: { marginBottom: 12 },
  heading: { fontSize: 11, fontWeight: 'bold', marginBottom: 5 },
  fields: { flexDirection: 'row', flexWrap: 'wrap' },
  field: { width: '50%', flexDirection: 'row', paddingVertical: 1.5 },
  label: { width: '40%', fontWeight: 'bold' },
  value: { width: '60%' },
  table: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: BORDER },
  row: { flexDirection: 'row' },
  headRow: { backgroundColor: '#f0f0f0' },
  cell: { borderRightWidth: 1, borderBottomWidth: 1, borderColor: BORDER, paddingVertical: 3, paddingHorizontal: 4 },
  headCell: { fontWeight: 'bold' },
  right: { textAlign: 'right' },
  muted: { color: '#666666' },
  footer: { position: 'absolute', bottom: 20, left: 32, right: 32, fontSize: 7, color: '#666666', textAlign: 'center' },
});

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
      <View style={[styles.row, styles.headRow]} wrap={false}>
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
        <View key={rowIndex} style={styles.row} wrap={false}>
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

function Header({ kind, data, symbol }: { kind: DocumentKind; data: CustomerReportDto; symbol: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.brand}>MicroBuilt</Text>
      <Text style={styles.title}>{documentTitle(kind)}</Text>
      <View style={styles.rule} />
      <Fields list={headerFields(data)} symbol={symbol} />
    </View>
  );
}

function Footer() {
  return (
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) =>
        `This is a computer-generated document and does not require a signature.  ·  Page ${pageNumber} of ${totalPages}`
      }
    />
  );
}

function statementDocument(data: CustomerReportDto, f: Fonts) {
  const admin = data.audience === 'admin';
  return (
    <Document title={`MicroBuilt statement — ${data.customer.name}`} author="MicroBuilt" creator="MicroBuilt">
      <Page size="A4" orientation={admin ? 'landscape' : 'portrait'} style={[styles.page, { fontFamily: f.family }]}>
        <Header kind="statement" data={data} symbol={f.symbol} />
        <Section title="Balances">
          <Fields list={balanceFields(data)} symbol={f.symbol} />
        </Section>
        <Section title="Transactions">
          <TableView table={statementTable(data)} symbol={f.symbol} fontSize={admin ? 7 : 8} />
        </Section>
        <Footer />
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
    <Document title={`MicroBuilt loan report — ${data.customer.name}`} author="MicroBuilt" creator="MicroBuilt">
      <Page size="A4" orientation={admin ? 'landscape' : 'portrait'} style={[styles.page, { fontFamily: f.family }]}>
        <Header kind="report" data={data} symbol={f.symbol} />
        <Section title="Customer">
          <Fields list={customerFields(data)} symbol={f.symbol} />
        </Section>
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
        <Section title="Statement" breakBefore>
          <TableView table={statementTable(data)} symbol={f.symbol} fontSize={admin ? 7 : 8} />
        </Section>
        <Footer />
      </Page>
    </Document>
  );
}

/** The statement: header, balances and every line of the range. */
export function renderStatementPdf(data: CustomerReportDto): Promise<Buffer> {
  return renderToBuffer(statementDocument(data, loadFonts()));
}

/** The report: header, customer, totals, loans and top-ups (admins: revenue and notes), then the statement. */
export function renderReportPdf(data: CustomerReportDto): Promise<Buffer> {
  return renderToBuffer(reportDocument(data, loadFonts()));
}
