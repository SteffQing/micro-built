// Queue and job names with their payloads: the contract between producers (QueueProducer) and
// the consumers in src/queue/bull. Money never moves in a job itself; a job calls the ledger,
// which runs its own transactions.

export enum QueueName {
  repayments = 'repayments',
  reports = 'reports',
  services = 'services',
  maintenance = 'maintenance',
}

export enum RepaymentQueueName {
  /**
   * Turns every row of a stored voucher into a PaymentInflow paid against its variation, then settles the
   * variation (PLAN_V2 R4).
   */
  process_voucher = 'process_voucher',
}

export enum ReportQueueName {
  /** Freezes one organization's deductions for a month and writes its variation file (PLAN_V2 R3). */
  variation_generate = 'variation_generate',
  /** A draft of what generating one organization's variation would produce now, emailed to whoever asked. */
  variation_draft = 'variation_draft',
  customer_report = 'customer_report',
  export_list = 'export_list',
}

export enum ServicesQueueName {
  onboard_existing_customers = 'onboard_existing_customers',
}

export enum MaintenanceQueueName {
  supabase_ping = 'supabase_ping',
  /** Near month end: tells super admins a month's variation still hasn't gone to payroll. */
  variation_reminder = 'variation_reminder',
  /** A callout's 7 days are up: delete it unless it was pinned or renewed since ({ calloutId }). */
  callout_expire = 'callout_expire',
  /** Hourly: deletes any callout past its date whose callout_expire job was lost. */
  callout_sweep = 'callout_sweep',
  /** v1's month-end auto-report; named only so its repeat schedule can be removed from Redis. */
  legacy_auto_report = 'auto-generate-missing-reports',
}

export interface AddExistingCustomers {
  file: Express.Multer.File;
  /** The admin uploading the sheet: the actor on every account and loan it creates. */
  requestedById: string;
}

export interface VoucherJob {
  /** Voucher.id: the sheet is already in the private bucket and the voucher recorded (its variation locked). */
  voucherId: string;
}

export interface VariationGenerateJob {
  organizationId: string;
  /** YYYY-MM */
  period: string;
  /** Told in-app when the job finishes or fails. */
  requestedById: string;
}

export interface VariationDraftJob {
  organizationId: string;
  /** YYYY-MM */
  period: string;
  email: string;
  requestedById: string;
}

export type ReportAudience = 'admin' | 'customer';
export type DocumentKind = 'statement' | 'report';
export type DocumentFormat = 'pdf' | 'xlsx';

/**
 * A customer's statement (the ledger lines) or report (a summary + the statement), as a file
 * delivered to `requestedById` (or the customer when absent) in-app, and to `email` when given.
 */
export interface CustomerReportJob {
  customerId: string;
  email?: string;
  requestedById?: string;
  audience: ReportAudience;
  kind: DocumentKind;
  format: DocumentFormat;
  /** YYYY-MM; the whole history when absent. */
  from?: string;
  to?: string;
  /** Encrypt the file so it only opens with the customer ID. */
  protect?: boolean;
}
