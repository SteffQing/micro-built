// Masks for what the assistant may see of personal data (CHAT_SUPPORT.md C3). Tools put every phone, email and account
// number through these before a model sees it; scrub.ts applies the same masks to the reply as a backstop.

const DOT = '•';

/** +2348012341234 → +234•••••1234; 08012341234 → 080•••••1234. */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return DOT.repeat(4);
  const international = phone.trim().startsWith('+') || digits.startsWith('234');
  const prefix = international ? `+${digits.slice(0, 3)}` : digits.slice(0, 3);
  return `${prefix}${DOT.repeat(5)}${digits.slice(-4)}`;
}

/** ada.obi@example.com → a•••@example.com. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 1) return DOT.repeat(4);
  return `${email[0]}${DOT.repeat(3)}${email.slice(at)}`;
}

/** 0123456789 → ••••6789. */
export function maskAccount(account: string | null | undefined): string | null {
  if (!account) return null;
  const digits = account.replace(/\D/g, '');
  return `${DOT.repeat(4)}${digits.slice(-4)}`;
}

/** At most `limit` rows plus whether there were more: what every list tool returns. */
export function capRows<T>(rows: T[], limit = 10): { rows: T[]; more: boolean } {
  return { rows: rows.slice(0, limit), more: rows.length > limit };
}

/** Copies only the whitelisted keys, so a field added to a service never reaches the model unreviewed. */
export function pick<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = source[key];
  return out;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// +234 803 123 4567, 234-803-123-4567, 0803 123 4567, 0803-123-4567.
const PHONE = /(?:\+?234|\b0)[\s-]?[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b/g;
// A bare run of 10 or 11 digits (an account number, BVN, phone): not part of an amount (1,000.00) or a longer number.
const DIGIT_RUN = /(?<![\d,.])\d{10,11}(?![\d,.]?\d)/g;

/** Masks emails, phone numbers and 10–11 digit runs in free text; amounts, ids like LN-104 and dates are left alone. */
export function maskSensitive(text: string): string {
  return text
    .replace(EMAIL, (email) => maskEmail(email) as string)
    .replace(PHONE, (phone) => maskPhone(phone) as string)
    .replace(DIGIT_RUN, (run) => maskAccount(run) as string);
}
