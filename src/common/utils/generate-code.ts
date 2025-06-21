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
