// SMS delivery sits behind this interface so the provider can change (D12: Termii today,
// Sendchamp is the fallback) without touching anything that sends texts.

export interface SmsMessage {
  /** +234… or any form the provider normalises. */
  to: string;
  text: string;
  /** One-time codes: sent on the route that reaches numbers registered on the DND list. */
  transactional?: boolean;
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
