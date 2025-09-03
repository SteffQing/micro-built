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

function liquidationRequestId(): string {
  return `LR-${nanoid(6)}`;
}

function anyId(prefix?: string, count = 6) {
  return `${prefix ?? 'ANY'}-${nanoid(count)}`;
}

export {
  userId,
  adminId,
  assetLoanId,
  loanId,
  repaymentId,
  anyId,
  liquidationRequestId,
};
