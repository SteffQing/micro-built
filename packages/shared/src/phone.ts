// Nigerian mobile numbers are stored as E.164: +234 followed by 10 digits.
// Accepted input: 08012345678, 8012345678, 2348012345678, +2348012345678,
// with any spaces, dashes, dots or brackets.
const NG_E164 = /^\+234[789]\d{9}$/;

export function normalizeNgPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '').replace(/^\+/, '');
  let national: string;
  if (/^234\d{10}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{10}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{10}$/.test(digits)) national = digits;
  else return null;
  const e164 = `+234${national}`;
  return NG_E164.test(e164) ? e164 : null;
}

export function isNigerianPhone(input: string): boolean {
  return normalizeNgPhone(input) !== null;
}
