// The list exports (D11): an admin or customer asks for a list as a spreadsheet; the reports
// queue builds it with the list's own filter and delivers it (private file, in-app link, email).

export type ExportDataset = 'customers' | 'cash_loans' | 'commodity_loans' | 'repayments';

export interface ExportListJob {
  dataset: ExportDataset;
  /** The list's query DTO as JSON, without page/limit/email (dates arrive as ISO strings). */
  filters: Record<string, unknown>;
  /** Who asked: gets the in-app notification with the download link. */
  requestedById: string;
  /** A real address to email the link to; without one the link arrives in-app only. */
  email?: string;
  /** A customer's own export: only their records, whatever the filters say. */
  scopeUserId?: string;
}

// v1's PDF report types, still imported by src/notifications/templates/CustomerReportPDF.tsx.
// Nothing renders that template in Stage 5; Stage 6 replaces it (report = summary + statement).

export type LoanSummary = {
  totalBorrowed: number;
  penaltiesCharged: number;
  totalInterest: number;
  paymentsMade: number;
  balance: number;
  status: 'active' | 'completed';
  start: Date;
  end: Date;
};

export type PaymentHistoryItem = {
  month: string;
  paymentDue: number;
  paymentMade: number;
  balanceAfter: number;
  remarks: string;
};
