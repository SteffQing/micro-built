import { customAlphabet } from 'nanoid';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const nanoid = customAlphabet(alphabet, 5);

function userId(): string {
  return `MB${nanoid()}`;
}

function adminId(): string {
  return `AD${nanoid()}`;
}

function vendorId(): string {
  return `VN${nanoid()}`;
}

function loanId(): string {
  return `LN${nanoid(6)}`;
}

export { userId, adminId, vendorId, loanId };
