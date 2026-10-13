// The services queue's existing-customer upload (QueueProducer.addExistingCustomers → ServicesConsumer).

/** The fields an import sheet's columns fill (src/queue/bull/service.utils.ts maps the headers). */
export type ImportKey =
  | 'externalId'
  | 'name'
  | 'organization'
  | 'command'
  | 'marketerName'
  | 'principal'
  | 'totalRepayable'
  | 'repaid'
  | 'outstanding'
  | 'monthlyDeduction'
  | 'startDate'
  | 'endDate'
  | 'bankName'
  | 'bvn'
  | 'contact'
  | 'tenure'
  | 'accountNumber';

/** One sheet row by field, its cells as SheetJS read them (text, numbers, dates as Excel serials). */
export type ImportedCustomerRow = Partial<Record<ImportKey, unknown>>;

export interface ExistingCustomerJob {
  /** Column index → the field it holds. */
  columnIndexToKey: Record<number, ImportKey>;
  /** The first sheet from row 1 (rawData[i] is sheet row i + 1). */
  rawData: unknown[][];
  headerRowIndex: number;
  /** The admin who uploaded the sheet: actor on every loan it imports, and who gets the summary. */
  requestedById: string;
  /** The import's reference (IMP-…) and the sheet's name, for the audit log; absent on a job queued before them. */
  importId?: string;
  fileName?: string;
}

/** What the upload checked before queueing: the audit entry records it. */
export interface QueuedImport {
  /** Rows under the header with anything in them. */
  dataRows: number;
  /** The sheet's header row (1-based) and the fields its columns were read as. */
  headerRow: number;
  columns: ImportKey[];
  sheetName: string;
}

/** What an import did; the uploader gets it in-app (and by email) and the job returns it. */
export interface ImportSummary {
  /** Rows with an IPPIS number. */
  total: number;
  imported: number;
  failed: number;
  /** Rows with other content but no IPPIS number (totals, notes). */
  skipped: number;
  /** "Row 12 (Jane Doe): …", in sheet order. */
  errors: string[];
  /** Rows that were imported but deserve a second look (e.g. a cash loan with no interest). */
  warnings: string[];
}
