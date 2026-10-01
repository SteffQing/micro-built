// Payroll repayments: where their files live, what a payroll sheet holds, and what processing a
// payroll upload reports.

/** Private bucket of payroll sheets as uploaded, at `<YYYY-MM>/<sha-256 of the file>.xlsx`. */
export const PAYROLL_UPLOADS_BUCKET = 'payroll-uploads';

/**
 * Private bucket of the proofs attached to liquidations (PaymentInflow.proofPath). Whoever creates
 * a liquidation uploads its proof here; admins open it through a short-lived signed URL.
 */
export const LIQUIDATION_PROOFS_BUCKET = 'liquidation-proofs';

/** A row's problem, as the validate endpoint reports it. */
export interface PayrollRowIssue {
  /** The sheet's own row number (the header is row 1). */
  row: number;
  staffId: string;
  issues: string[];
}

/** What a payroll sheet's checks found; `valid` when `problems` is empty. */
export interface PayrollSheetReport {
  valid: boolean;
  /** The month the sheet is for ("JUNE 2026"); null when no row's Period could be read. */
  period: string | null;
  /** Data rows (blank rows are ignored). */
  rows: number;
  missingColumns: string[];
  /** Plain sentences, most important first; an upload is refused with the first one. */
  problems: string[];
  invalidRows: PayrollRowIssue[];
}

/** What an accepted upload answers with; its rows are processed by the repayments queue. */
export interface PayrollUploadReceipt {
  uploadId: string;
  /** "JUNE 2026" */
  period: string;
  rows: number;
}

/** What became of one row of a payroll sheet (V2.MD §0.5 "Payroll row"). */
export type PayrollRowOutcome =
  /** Applied in full to the month's deduction. */
  | 'SETTLED'
  /** Recorded for an admin: no live loan, no deduction that month, or paid more than owed. */
  | 'REVIEWING'
  /** No customer has this staff ID. */
  | 'UNMATCHED'
  /** This employee's row for this month was already imported (an earlier upload or run). */
  | 'DUPLICATE'
  /** Threw; nothing was recorded, so running the job again retries it. */
  | 'FAILED'
  /** Nothing was deducted (amount 0): no payment to record. */
  | 'SKIPPED';

/** The result of the process_payroll_upload job, also sent to the admin who uploaded the sheet. */
export interface PayrollUploadSummary {
  uploadId: string;
  /** "JUNE 2026" */
  period: string;
  rows: number;
  settled: number;
  reviewing: number;
  unmatched: number;
  duplicate: number;
  failed: number;
  skipped: number;
}
