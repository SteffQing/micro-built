import { customAlphabet } from 'nanoid';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const nanoid = customAlphabet(alphabet, 5);

function userId(): string {
  return `MB-${nanoid()}`;
}

function adminId(): string {
  return `AD-${nanoid()}`;
}

function assetLoanId(): string {
  return `CLN-${nanoid(6)}`;
}

function repaymentId(): string {
  return `RP-${nanoid(6)}`;
}

function loanId(): string {
  return `LN-${nanoid(6)}`;
}

function anyId(prefix?: string) {
  return `${prefix}-${nanoid()}`;
}

export { userId, adminId, assetLoanId, loanId, repaymentId, anyId };
