import { Injectable, Logger } from '@nestjs/common';
import type { SmsMessage, SmsProvider } from './sms.provider';

/** "+2348012345678", "08012345678" → "2348012345678", the form Termii expects. */
export function termiiNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `234${digits.slice(1)}` : digits;
}

const masked = (phone: string) => `${phone.slice(0, 4)}…${phone.slice(-3)}`;

@Injectable()
export class TermiiProvider implements SmsProvider {
  private readonly logger = new Logger(TermiiProvider.name);
  private readonly apiKey = process.env.TERMII_API_KEY;
  private readonly senderId = process.env.TERMII_SENDER_ID || 'MicroBuilt';
  private readonly baseUrl = process.env.TERMII_BASE_URL || 'https://api.ng.termii.com';

  async send({ to, text, transactional }: SmsMessage): Promise<void> {
    if (!this.apiKey) {
      // Local runs without a key: say what would have gone out, but never print a code in production.
      const body = process.env.NODE_ENV === 'production' ? '' : `: ${text}`;
      this.logger.warn(`TERMII_API_KEY is not set; not texting ${masked(to)}${body}`);
      return;
    }

    const response = await fetch(`${this.baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: termiiNumber(to),
        from: this.senderId,
        sms: text,
        type: 'plain',
        // "dnd" reaches lines on the Do-Not-Disturb register, which "generic" silently skips.
        channel: transactional ? 'dnd' : 'generic',
        api_key: this.apiKey,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Termii refused the SMS to ${masked(to)} (${response.status}): ${detail}`);
    }
  }
}
