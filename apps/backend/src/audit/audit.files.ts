// Private buckets for files the audit log points at (an entry's `meta.storedFile`).

/** Every customer import sheet as uploaded, under `<importId>/<file name>`. */
export const IMPORTS_BUCKET = 'customer-imports';

/** Database exports, under `<exportId>/<file name>`; handed out as a 1-hour link to whoever asked. */
export const DATABASE_EXPORTS_BUCKET = 'database-exports';

/** Where an entry's file is, as `meta.storedFile` records it. */
export interface StoredFile {
  bucket: string;
  path: string;
}

/** The buckets an audit entry may name: a signed link is only ever made for these. */
export const AUDIT_FILE_BUCKETS = new Set([IMPORTS_BUCKET]);

export function storedFileOf(meta: unknown): StoredFile | null {
  const file = (meta as { storedFile?: unknown } | null)?.storedFile as Partial<StoredFile> | null | undefined;
  return file && typeof file.bucket === 'string' && typeof file.path === 'string' && AUDIT_FILE_BUCKETS.has(file.bucket)
    ? { bucket: file.bucket, path: file.path }
    : null;
}
