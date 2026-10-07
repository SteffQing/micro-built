import { BadRequestException, Logger } from '@nestjs/common';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const logger = new Logger('Turnstile');

/** Visitors pass Turnstile once per new conversation (C7) when the secret is configured. */
export const turnstileRequired = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

/**
 * Checks a visitor's Turnstile token with Cloudflare, or throws 400. Cloudflare being unreachable is answered the same
 * as a failed check: the visitor can try again.
 */
export async function verifyTurnstile(token: string | undefined, ip: string | null, fetcher: typeof fetch = fetch) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (!token) throw new BadRequestException('Confirm you are human to start a conversation');
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const response = await fetcher(SITEVERIFY, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    const result = (await response.json()) as { success?: boolean };
    if (result.success) return;
  } catch (error) {
    logger.warn(`Turnstile check failed: ${(error as Error).message}`);
  }
  throw new BadRequestException("We couldn't confirm you are human. Try again.");
}
