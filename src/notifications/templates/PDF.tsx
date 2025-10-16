import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { formatCurrency } from 'src/common/utils';

interface PaymentHistoryItem {
  month: string;
  paymentDue: number;
  paymentMade: number;
  datePaid: string;
  balanceAfter: number;
  remarks: string;
}

interface LoanSummary {
  initialLoan: number;
  topUpLoan?: number;
  topUpMonth?: string;
  totalLoan: number;
  totalInterest: number;
  totalPayable: number;
  monthlyInstallment: string;
  paymentsMade: number;
  balance: number;
  balanceNote?: string;
  status: string;
}

interface LoanReportProps {
  companyName: string;
  reportTitle: string;
  customerName: string;
  customerId: string;
  loanSummary: LoanSummary;
  paymentHistory: PaymentHistoryItem[];
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 10,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  customerInfo: {
    marginBottom: 20,
  },
  customerInfoText: {
    fontSize: 10,
    marginBottom: 3,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 10,
  },
  table: {
    width: '100%',
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    borderLeftWidth: 1,
    borderLeftColor: '#ddd',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    borderLeftWidth: 1,
    borderLeftColor: '#ddd',
  },
  tableCell: {
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    fontSize: 9,
  },
  tableCellBold: {
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    fontSize: 9,
    fontWeight: 'bold',
  },
  tableCellRed: {
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  tableCellBlue: {
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  summaryCol1: {
    width: '40%',
  },
  summaryCol2: {
    width: '60%',
  },
  historyCol1: {
    width: '12%',
  },
  historyCol2: {
    width: '16%',
  },
  historyCol3: {
    width: '16%',
  },
  historyCol4: {
    width: '12%',
  },
  historyCol5: {
    width: '20%',
  },
  historyCol6: {
    width: '24%',
  },
  footer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
  },
  defaultRow: {
    backgroundColor: '#fee',
  },
});

const LoanReportDocument: React.FC<LoanReportProps> = ({
  companyName,
  reportTitle,
  customerName,
  customerId,
  loanSummary,
  paymentHistory,
}) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.reportTitle}>{reportTitle}</Text>
        </View>

        {/* Customer Info */}
        <View style={styles.customerInfo}>
          <Text style={styles.customerInfoText}>
            <Text style={{ fontWeight: 'bold' }}>Customer Name:</Text>{' '}
            {customerName}
          </Text>
          <Text style={styles.customerInfoText}>
            <Text style={{ fontWeight: 'bold' }}>Customer ID:</Text>{' '}
            {customerId}
          </Text>
        </View>

        {/* Loan Summary */}
        <Text style={styles.sectionTitle}>1. Loan Summary</Text>
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.tableCellBold, styles.summaryCol1]}>
              <Text>Item</Text>
            </View>
            <View style={[styles.tableCellBold, styles.summaryCol2]}>
              <Text>Details</Text>
            </View>
          </View>

          {/* Data Rows */}
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, styles.summaryCol1]}>
              <Text>Initial Loan</Text>
            </View>
            <View style={[styles.tableCell, styles.summaryCol2]}>
              <Text>{formatCurrency(loanSummary.initialLoan)}</Text>
            </View>
          </View>

          {loanSummary.topUpLoan && (
            <View style={styles.tableRow}>
              <View style={[styles.tableCell, styles.summaryCol1]}>
                <Text>Top-Up Loan</Text>
              </View>
              <View style={[styles.tableCell, styles.summaryCol2]}>
                <Text>
                  {formatCurrency(loanSummary.topUpLoan)} (
                  {loanSummary.topUpMonth})
                </Text>
              </View>
            </View>
          )}

          <View style={styles.tableRow}>
            <View style={[styles.tableCell, styles.summaryCol1]}>
              <Text>Total Loan</Text>
            </View>
            <View style={[styles.tableCellBold, styles.summaryCol2]}>
              <Text>{formatCurrency(loanSummary.totalLoan)}</Text>
            </View>
          </View>

          <View style={styles.tableRow}>
            <View style={[styles.tableCell, styles.summaryCol1]}>
              <Text>Total Interest (Annual)</Text>
            </View>
            <View style={[styles.tableCell, styles.summaryCol2]}>
              <Text>{formatCurrency(loanSummary.totalInterest)}</Text>
            </View>
          </View>

          <View style={styles.tableRow}>
            <View style={[styles.tableCell, styles.summaryCol1]}>
              <Text>Total Payable</Text>
            </View>
            <View style={[styles.tableCellBold, styles.summaryCol2]}>
              <Text>{formatCurrency(loanSummary.totalPayable)}</Text>
            </View>
          </View>

          <View style={styles.tableRow}>
            <View style={[styles.tableCell, styles.summaryCol1]}>
              <Text>Monthly Installment</Text>
            </View>
            <View style={[styles.tableCell, styles.summaryCol2]}>
              <Text>₦{loanSummary.monthlyInstallment}</Text>
            </View>
          </View>

          <View style={styles.tableRow}>
            <View style={[styles.tableCell, styles.summaryCol1]}>
              <Text>Payments Made</Text>
            </View>
            <View style={[styles.tableCell, styles.summaryCol2]}>
              <Text>{formatCurrency(loanSummary.paymentsMade)}</Text>
            </View>
          </View>

          <View style={styles.tableRow}>
            <View style={[styles.tableCell, styles.summaryCol1]}>
              <Text>Balance</Text>
            </View>
            <View style={[styles.tableCellRed, styles.summaryCol2]}>
              <Text>
                {formatCurrency(loanSummary.balance)}{' '}
                {loanSummary.balanceNote || ''}
              </Text>
            </View>
          </View>

          <View style={styles.tableRow}>
            <View style={[styles.tableCell, styles.summaryCol1]}>
              <Text>Status</Text>
            </View>
            <View style={[styles.tableCellRed, styles.summaryCol2]}>
              <Text>{loanSummary.status}</Text>
            </View>
          </View>
        </View>

        {/* Payment History */}
        <Text style={styles.sectionTitle}>
          2. Payment History (Jan – Dec 2024)
        </Text>
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.tableCellBold, styles.historyCol1]}>
              <Text>Month</Text>
            </View>
            <View style={[styles.tableCellBold, styles.historyCol2]}>
              <Text>Payment Due</Text>
            </View>
            <View style={[styles.tableCellBold, styles.historyCol3]}>
              <Text>Payment Made</Text>
            </View>
            <View style={[styles.tableCellBold, styles.historyCol4]}>
              <Text>Date Paid</Text>
            </View>
            <View style={[styles.tableCellBold, styles.historyCol5]}>
              <Text>Balance After</Text>
            </View>
            <View style={[styles.tableCellBold, styles.historyCol6]}>
              <Text>Remarks</Text>
            </View>
          </View>

          {/* Data Rows */}
          {paymentHistory.map((payment, index) => {
            const isDefault = payment.paymentMade === 0;
            const isLate =
              payment.remarks.includes('Late') ||
              payment.remarks.includes('Default');
            const isTopUp = payment.remarks.includes('Top-Up');

            return (
              <View
                key={index}
                style={[styles.tableRow, isDefault ? styles.defaultRow : {}]}
              >
                <View style={[styles.tableCell, styles.historyCol1]}>
                  <Text>{payment.month}</Text>
                </View>
                <View style={[styles.tableCell, styles.historyCol2]}>
                  <Text>{formatCurrency(payment.paymentDue)}</Text>
                </View>
                <View style={[styles.tableCell, styles.historyCol3]}>
                  <Text>
                    {payment.paymentMade === 0
                      ? '₦0'
                      : formatCurrency(payment.paymentMade)}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.historyCol4]}>
                  <Text>{payment.datePaid}</Text>
                </View>
                <View style={[styles.tableCell, styles.historyCol5]}>
                  <Text>{formatCurrency(payment.balanceAfter)}</Text>
                </View>
                <View
                  style={[
                    isLate
                      ? styles.tableCellRed
                      : isTopUp
                        ? styles.tableCellBlue
                        : styles.tableCell,
                    styles.historyCol6,
                  ]}
                >
                  <Text>{payment.remarks}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            This is a computer-generated report and does not require a
            signature.
          </Text>
          <Text>Generated on {new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default async function generateLoanReportPDF(
  data: LoanReportProps,
): Promise<Buffer> {
  const document = (
    <LoanReportDocument
      companyName={data.companyName}
      reportTitle={data.reportTitle}
      customerName={data.customerName}
      customerId={data.customerId}
      loanSummary={data.loanSummary}
      paymentHistory={data.paymentHistory}
    />
  );

  const buffer = await renderToBuffer(document);
  return buffer;
}
