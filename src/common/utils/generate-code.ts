import * as crypto from 'crypto';

export function resetToken() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  return { hashedToken, resetToken };
}

export function hashToken(token: string) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  return hashedToken;
}

export function sixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generatePassword(length = 8) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
  const allChars = upper + lower + numbers + symbols;

  const getRandom = (str: string) =>
    str[Math.floor(Math.random() * str.length)];

  let password = [
    getRandom(upper),
    getRandom(lower),
    getRandom(numbers),
    getRandom(symbols),
  ];

  for (let i = password.length; i < length; i++) {
    password.push(getRandom(allChars));
  }

  return password.sort(() => Math.random() - 0.5).join('');
}
