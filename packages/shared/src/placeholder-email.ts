import { normalizeNgPhone } from './phone';

// better-auth v1 requires an email on every user. Customers who sign up with
// only a phone number get this placeholder instead; it is never shown and
// never mailed. The system user uses the second domain.
export const PHONE_EMAIL_DOMAIN = 'phone.microbuiltprime.com';
export const SYSTEM_EMAIL_DOMAIN = 'system.microbuiltprime.com';

export function placeholderEmail(phone: string): string {
  const e164 = normalizeNgPhone(phone);
  if (!e164) throw new Error(`Not a Nigerian mobile number: ${phone}`);
  return `${e164.slice(1)}@${PHONE_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  return domain === PHONE_EMAIL_DOMAIN || domain === SYSTEM_EMAIL_DOMAIN;
}

// The email to show or send to: null for placeholders.
export function visibleEmail(email: string | null | undefined): string | null {
  return email && !isPlaceholderEmail(email) ? email : null;
}
