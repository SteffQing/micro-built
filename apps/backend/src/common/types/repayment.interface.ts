// Payroll repayments: where their files live, what a voucher (an organization's payroll return)
// holds, and what processing one reports (PLAN_V2 R4).

/** Private bucket of vouchers as uploaded, at `<YYYY-MM>/<sha-256 of the file>.xlsx`. */
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

export interface OrganizationRef {
  id: string;
  name: string;
}

/** An earlier month of the organization whose variation has no voucher and no "no payroll" yet (P8). */
export interface EarlierUnlocked {
  variationId: string;
  /** "2026-09" */
  ym: string;
  /** "SEPTEMBER 2026" */
  label: string;
}

/** Rows a voucher would leave for an admin to resolve, by why (validate only). */
export interface VoucherIssueCounts {
  /** No customer has the row's staff ID. */
  unmatched: number;
  /** The customer belongs to another organization. */
  otherOrganization: number;
  /** The customer is in this organization but has no deduction in the variation. */
  notInVariation: number;
}

/** What the validate route reports: the sheet's own checks plus the voucher's (PLAN_V2 §2). */
export interface VoucherReport extends PayrollSheetReport {
  organization: OrganizationRef;
  /** The organization's variation for the sheet's month, when it has been generated. */
  variation: { id: string; version: number } | null;
  issues: VoucherIssueCounts;
  earlierUnlocked: EarlierUnlocked[];
  /** Why the upload would be refused with a 409 (also in `problems`). */
  conflicts: string[];
}

/** What an accepted voucher answers with; its rows are processed by the repayments queue. */
export interface VoucherReceipt {
  voucherId: string;
  variationId: string;
  organization: OrganizationRef;
  /** "JUNE 2026" */
  period: string;
  rows: number;
}

/** What became of one row of a voucher (PLAN_V2 R4 step 1). */
export type PayrollRowOutcome =
  /** Applied in full to the loan's deduction in the variation. */
  | 'SETTLED'
  /**
   * Recorded for an admin: no live loan, the customer is in another organization, no deduction in the
   * variation, or paid more than owed.
   */
  | 'REVIEWING'
  /** No customer has this staff ID. */
  | 'UNMATCHED'
  /** This employee's row for this month was already imported (an earlier upload or run). */
  | 'DUPLICATE'
  /** Threw; nothing was recorded, so running the job again retries it. */
  | 'FAILED'
  /** Nothing was deducted (amount 0): no payment to record. */
  | 'SKIPPED';

/** How the variation settled once the rows were in (VariationLockService.settleVariation). */
export interface VoucherSettlement {
  /** False when some deductions failed to settle: the job is retried, finished rows are skipped. */
  settled: boolean;
  failed: number;
  partial: number;
  penalties: number;
  penaltyTotal: number;
  proposals: number;
}

/** The result of the process_voucher job, also sent to the admin who uploaded the voucher. */
export interface VoucherSummary {
  voucherId: string;
  variationId: string;
  /** "NPF" */
  organization: string;
  /** "JUNE 2026" */
  period: string;
  rows: number;
  settled: number;
  reviewing: number;
  unmatched: number;
  duplicate: number;
  failed: number;
  skipped: number;
  /** Null when the settlement couldn't run (the job failed after the rows). */
  settlement: VoucherSettlement | null;
}
