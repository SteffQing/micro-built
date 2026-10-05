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
  /** Turns every row of a stored payroll return into a PaymentInflow and applies it (§0.5 payroll row). */
  process_payroll_upload = 'process_payroll_upload',
}

export enum ReportQueueName {
  /** A draft variation file for a period, emailed to whoever asked; submitting is not a job. */
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
  /** v1's month-end auto-report; named only so its repeat schedule can be removed from Redis. */
  legacy_auto_report = 'auto-generate-missing-reports',
}

export interface AddExistingCustomers {
  file: Express.Multer.File;
  /** The admin uploading the sheet: the actor on every account and loan it creates. */
  requestedById: string;
}

export interface PayrollUploadJob {
  /** PayrollUpload.id: the sheet is already in the private bucket and the row recorded. */
  uploadId: string;
}

export interface VariationDraftJob {
  periodId: string;
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
