import PDFDocument from 'pdfkit';
import type {
  LoanSummary,
  PaymentHistoryItem,
} from 'src/common/types/report.interface';
import { formatCurrency } from 'src/common/utils';

interface LoanReportProps {
  start: string;
  end: string;
  customerName: string;
  ippisId: string;
  summaries: Array<LoanSummary>;
  paymentHistory: PaymentHistoryItem[];
}

export class PdfGeneratorService {
  async generateLoanReportPDF(data: LoanReportProps): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      this.addHeader(doc, data);

      // Customer Info
      this.addCustomerInfo(doc, data);

      // Loan Summary
      this.addLoanSummary(doc, data.summaries);

      // Payment History
      this.addPaymentHistory(doc, data);

      // Footer
      this.addFooter(doc);

      doc.end();
    });
  }

  private addHeader(doc: any, data: LoanReportProps) {
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('MicroBuilt Ltd.', { align: 'left' });

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#333333')
      .text(`Customer Loan Report (${data.start} - ${data.end})`, {
        align: 'left',
      });

    doc
      .moveTo(40, doc.y + 5)
      .lineTo(555, doc.y + 5)
      .lineWidth(2)
      .stroke('#000000');

    doc.moveDown(1);
    doc.fillColor('#000000');
  }

  private addCustomerInfo(doc: any, data: LoanReportProps) {
    doc.fontSize(10).font('Helvetica');

    doc
      .font('Helvetica-Bold')
      .text('Customer Name: ', { continued: true })
      .font('Helvetica')
      .text(data.customerName);

    doc
      .font('Helvetica-Bold')
      .text('Customer ID: ', { continued: true })
      .font('Helvetica')
      .text(data.ippisId);

    doc.moveDown(1);
  }

  private addLoanSummary(doc: any, summaries: LoanSummary[]) {
    doc.fontSize(12).font('Helvetica-Bold').text('1. Loan Summary');
    doc.moveDown(0.5);

    summaries.forEach((summary, index) => {
      const startY = doc.y;
      const tableWidth = 515;
      const col1Width = tableWidth * 0.4;
      const col2Width = tableWidth * 0.6;

      // Table header
      this.drawTableRow(
        doc,
        40,
        startY,
        ['Item', 'Details'],
        [col1Width, col2Width],
        true,
      );

      let currentY = startY + 20;

      // Table rows
      const rows = [
        ['Initial Loan', formatCurrency(summary.initialLoan)],
        ['Total Loan', formatCurrency(summary.totalLoan), true],
        ['Total Interest (Annual)', formatCurrency(summary.totalInterest)],
        ['Total Payable', formatCurrency(summary.totalPayable), true],
        ['Monthly Installment', `₦${summary.monthlyInstallment}`],
        ['Payments Made', formatCurrency(summary.paymentsMade)],
        ['Balance', formatCurrency(summary.balance), false, true],
        ['Status', summary.status, false, true],
      ];

      rows.forEach(([label, value, isBold, isRed]) => {
        this.drawTableRow(
          doc,
          40,
          currentY,
          [String(label), value as string],
          [col1Width, col2Width],
          false,
          isBold as boolean,
          isRed as boolean,
        );
        currentY += 20;
      });

      doc.moveDown(1);
    });
  }

  private addPaymentHistory(doc: any, data: LoanReportProps) {
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(`2. Payment History (${data.start} - ${data.end})`);
    doc.moveDown(0.5);

    const startY = doc.y;
    const tableWidth = 515;
    const colWidths = [
      tableWidth * 0.12, // Period
      tableWidth * 0.16, // Payment Due
      tableWidth * 0.16, // Payment Made
      tableWidth * 0.2, // Balance After
      tableWidth * 0.36, // Remarks
    ];

    // Check if we need a new page
    if (startY > 650) {
      doc.addPage();
    }

    // Table header
    this.drawTableRow(
      doc,
      40,
      doc.y,
      ['Period', 'Payment Due', 'Payment Made', 'Balance After', 'Remarks'],
      colWidths,
      true,
    );

    let currentY = doc.y + 20;

    data.paymentHistory.forEach((payment) => {
      // Check if we need a new page
      if (currentY > 750) {
        doc.addPage();
        currentY = 40;
        // Redraw header on new page
        this.drawTableRow(
          doc,
          40,
          currentY,
          ['Period', 'Payment Due', 'Payment Made', 'Balance After', 'Remarks'],
          colWidths,
          true,
        );
        currentY += 20;
      }

      const isDefault = payment.paymentMade === 0;
      const isLate =
        payment.remarks.includes('Late') || payment.remarks.includes('Default');
      const isTopUp = payment.remarks.includes('Top-Up');

      const rowData = [
        payment.month,
        formatCurrency(payment.paymentDue),
        payment.paymentMade === 0 ? '₦0' : formatCurrency(payment.paymentMade),
        formatCurrency(payment.balanceAfter),
        payment.remarks,
      ];

      this.drawTableRow(
        doc,
        40,
        currentY,
        rowData,
        colWidths,
        false,
        false,
        isLate,
        isDefault,
        isTopUp,
      );

      currentY += 20;
    });

    doc.y = currentY;
  }

  private drawTableRow(
    doc: any,
    x: number,
    y: number,
    data: string[],
    colWidths: number[],
    isHeader = false,
    isBold = false,
    isRed = false,
    hasDefaultBg = false,
    isBlue = false,
  ) {
    const rowHeight = 20;
    const padding = 6;

    // Draw background for header or default rows
    if (isHeader) {
      doc
        .rect(
          x,
          y,
          colWidths.reduce((a, b) => a + b, 0),
          rowHeight,
        )
        .fillAndStroke('#f0f0f0', '#dddddd');
    } else if (hasDefaultBg) {
      doc
        .rect(
          x,
          y,
          colWidths.reduce((a, b) => a + b, 0),
          rowHeight,
        )
        .fillAndStroke('#ffeeee', '#dddddd');
    } else {
      doc
        .rect(
          x,
          y,
          colWidths.reduce((a, b) => a + b, 0),
          rowHeight,
        )
        .stroke('#dddddd');
    }

    // Draw cell borders
    let currentX = x;
    colWidths.forEach((width) => {
      doc
        .moveTo(currentX, y)
        .lineTo(currentX, y + rowHeight)
        .stroke('#dddddd');
      currentX += width;
    });
    doc
      .moveTo(currentX, y)
      .lineTo(currentX, y + rowHeight)
      .stroke('#dddddd');

    // Draw text
    currentX = x;
    doc.fontSize(9);

    data.forEach((text, index) => {
      const font = isHeader || isBold ? 'Helvetica-Bold' : 'Helvetica';
      const color = isRed ? '#dc2626' : isBlue ? '#2563eb' : '#000000';

      doc
        .font(font)
        .fillColor(color)
        .text(text, currentX + padding, y + padding, {
          width: colWidths[index] - padding * 2,
          height: rowHeight - padding * 2,
          align: 'left',
          ellipsis: true,
        });

      currentX += colWidths[index];
    });

    doc.fillColor('#000000');
  }

  private addFooter(doc: any) {
    doc.moveDown(1);

    doc.moveTo(40, doc.y).lineTo(555, doc.y).lineWidth(1).stroke('#dddddd');

    doc.moveDown(0.5);

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text(
        'This is a computer-generated report and does not require a signature.',
        { align: 'center' },
      );

    doc.text(`Generated on ${new Date().toLocaleDateString()}`, {
      align: 'center',
    });

    doc.fillColor('#000000');
  }
}

export default async function generateLoanReportPDF(
  data: LoanReportProps,
): Promise<Buffer> {
  const service = new PdfGeneratorService();
  return service.generateLoanReportPDF(data);
}
