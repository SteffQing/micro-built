import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey = process.env.TERMII_API_KEY;
  private readonly senderId = process.env.TERMII_SENDER_ID || 'MicroBuilt';
  private readonly baseUrl =
    process.env.TERMII_BASE_URL || 'https://api.ng.termii.com';

  async send(to: string, message: string) {
    if (!this.apiKey) {
      this.logger.warn(
        `TERMII_API_KEY not set — skipping SMS to ${to}: ${message}`,
      );
      return;
    }

    const response = await fetch(`${this.baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: this.normalizePhone(to),
        from: this.senderId,
        sms: message,
        type: 'plain',
        channel: 'generic',
        api_key: this.apiKey,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Failed to send SMS (${response.status}): ${body}`);
    }
  }

  // Termii expects international format without a leading "+" (e.g. 2348012345678)
  private normalizePhone(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) return `234${digits.slice(1)}`;
    return digits;
  }
}
