import { customAlphabet } from 'nanoid';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const nanoid = customAlphabet(alphabet, 5);

function userId(): string {
  return `MB-${nanoid()}`;
}

function adminId(): string {
  return `AD-${nanoid()}`;
}

function loanId(): string {
  return `LN-${nanoid(6)}`;
}

/** A customer import's reference: names it in the audit log and its stored sheet. */
function importId(): string {
  return `IMP-${nanoid(6)}`;
}

/** A database export's reference, in the audit log and the file name. */
function databaseExportId(): string {
  return `DBX-${nanoid(6)}`;
}

export { userId, adminId, loanId, importId, databaseExportId };
