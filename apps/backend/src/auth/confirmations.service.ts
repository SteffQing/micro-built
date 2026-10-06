import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import { generateRandomString } from 'better-auth/crypto';
import type { AuthUser } from 'src/common/types';
import { PrismaService } from 'src/database/prisma.service';
import { AuthAccountsService } from './auth-accounts.service';

export type ConfirmMode = 'action' | 'window';

export const CONFIRMATION_REQUIRED = 'CONFIRMATION_REQUIRED';
export const CONFIRMATION_SETUP_REQUIRED = 'CONFIRMATION_SETUP_REQUIRED';
/** The header (or, for uploads that skip custom headers, the `confirmation` query parameter) carrying the token. */
export const CONFIRMATION_HEADER = 'x-confirmation';

/** The relying party passkeys were registered for (PASSKEY_RP_ID and the frontend origins). */
export const PASSKEY_RP = Symbol('PASSKEY_RP');
export interface PasskeyRp {
  rpID: string;
  origin: string | string[];
}

/** A passkey prompt left open this long is abandoned. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
/** A confirmation not spent by an action within this long is no good for one. */
const ACTION_TTL_MS = 5 * 60 * 1000;
/** After confirming, "window" actions (settings, admin management, adding customers) go through for this long. */
export const WINDOW_MS = 10 * 60 * 1000;

export interface ConfirmationMethods {
  totp: boolean;
  passkey: boolean;
}

export interface ConfirmationGrant {
  token: string;
  expiresAt: Date;
}

/**
 * Re-proving it's you (authenticator code or passkey) before a gated action. Money and ledger actions spend one
 * confirmation each ("action"); settings-like actions accept any confirmation of the same session from the last ten
 * minutes ("window"). Bound to the session, so a token lifted from one device is no good on another.
 */
@Injectable()
export class ConfirmationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AuthAccountsService,
    @Inject(PASSKEY_RP) private readonly rp: PasskeyRp,
  ) {}

  async methods(userId: string): Promise<ConfirmationMethods> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, _count: { select: { passkeys: true } } },
    });
    return { totp: user?.twoFactorEnabled === true, passkey: (user?._count.passkeys ?? 0) > 0 };
  }

  async confirmWithCode(userId: string, sessionId: string, code: string): Promise<ConfirmationGrant> {
    const methods = await this.methods(userId);
    if (!methods.totp) throw new ForbiddenException('Turn on two-factor authentication to confirm with a code');
    await this.accounts.assertTwoFactorCode(userId, code);
    return this.grant(userId, sessionId, 'TOTP');
  }

  /** Starts a passkey prompt limited to the user's own passkeys, with the fingerprint/face/PIN step required. */
  async passkeyOptions(
    userId: string,
    sessionId: string,
  ): Promise<{ id: string; options: PublicKeyCredentialRequestOptionsJSON }> {
    const passkeys = await this.prisma.passkey.findMany({
      where: { userId },
      select: { credentialID: true, transports: true },
    });
    if (passkeys.length === 0) throw new ForbiddenException('Add a passkey to confirm with one');
    const options = await generateAuthenticationOptions({
      rpID: this.rp.rpID,
      userVerification: 'required',
      allowCredentials: passkeys.map((p) => ({ id: p.credentialID, transports: transportsOf(p.transports) })),
    });
    const id = generateRandomString(32, 'a-z', 'A-Z', '0-9');
    await this.prisma.confirmation.create({
      data: { id, userId, sessionId, challenge: options.challenge, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
    });
    void this.sweep(userId);
    return { id, options };
  }

  async confirmWithPasskey(
    userId: string,
    sessionId: string,
    id: string,
    response: AuthenticationResponseJSON,
  ): Promise<ConfirmationGrant> {
    const failed = new ForbiddenException('That passkey could not be verified. Try again');
    const pending = await this.prisma.confirmation.findFirst({
      where: { id, userId, sessionId, confirmedAt: null, expiresAt: { gt: new Date() } },
      select: { challenge: true },
    });
    if (!pending?.challenge) throw new BadRequestException('This passkey prompt has expired. Start again');
    const passkey = await this.prisma.passkey.findFirst({ where: { userId, credentialID: response?.id } });
    if (!passkey) throw failed;

    let verified = false;
    let newCounter = passkey.counter;
    try {
      const result = await verifyAuthenticationResponse({
        response,
        expectedChallenge: pending.challenge,
        expectedOrigin: this.rp.origin,
        expectedRPID: this.rp.rpID,
        credential: {
          id: passkey.credentialID,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64')),
          counter: passkey.counter,
          transports: transportsOf(passkey.transports),
        },
        requireUserVerification: true,
      });
      verified = result.verified;
      newCounter = result.authenticationInfo.newCounter;
    } catch {
      verified = false;
    }
    if (!verified) throw failed;

    const now = new Date();
    // Spend the challenge exactly once, even if the same response is sent twice.
    const { count } = await this.prisma.confirmation.updateMany({
      where: { id, confirmedAt: null },
      data: { challenge: null, method: 'PASSKEY', confirmedAt: now, expiresAt: new Date(now.getTime() + ACTION_TTL_MS) },
    });
    if (count === 0) throw new BadRequestException('This passkey prompt has expired. Start again');
    await this.prisma.passkey.update({ where: { id: passkey.id }, data: { counter: newCounter } });
    return { token: id, expiresAt: new Date(now.getTime() + ACTION_TTL_MS) };
  }

  /**
   * Passes when the session holds what `mode` needs; otherwise 403 CONFIRMATION_REQUIRED (the frontend asks for a code
   * or passkey and retries), or CONFIRMATION_SETUP_REQUIRED when the user has neither.
   */
  async assert(user: AuthUser, sessionId: string | undefined, token: string | undefined, mode: ConfirmMode) {
    const methods = await this.methods(user.userId);
    if (!methods.totp && !methods.passkey) {
      throw new ForbiddenException({
        statusCode: 403,
        code: CONFIRMATION_SETUP_REQUIRED,
        message: 'Turn on two-factor authentication or add a passkey to do this',
      });
    }
    if (sessionId && (await this.holds(user.userId, sessionId, token, mode))) return;
    throw new ForbiddenException({
      statusCode: 403,
      code: CONFIRMATION_REQUIRED,
      mode,
      methods,
      message: "Confirm it's you to continue",
    });
  }

  private async holds(userId: string, sessionId: string, token: string | undefined, mode: ConfirmMode) {
    const now = new Date();
    if (mode === 'window') {
      const recent = await this.prisma.confirmation.findFirst({
        where: { userId, sessionId, confirmedAt: { gte: new Date(now.getTime() - WINDOW_MS) } },
        select: { id: true },
      });
      return recent !== null;
    }
    if (!token) return false;
    const { count } = await this.prisma.confirmation.updateMany({
      where: { id: token, userId, sessionId, confirmedAt: { not: null }, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    return count === 1;
  }

  private async grant(userId: string, sessionId: string, method: 'TOTP' | 'PASSKEY'): Promise<ConfirmationGrant> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ACTION_TTL_MS);
    const token = generateRandomString(32, 'a-z', 'A-Z', '0-9');
    await this.prisma.confirmation.create({
      data: { id: token, userId, sessionId, method, confirmedAt: now, expiresAt },
    });
    void this.sweep(userId);
    return { token, expiresAt };
  }

  /** Old rows are only history nobody reads; keep a day for debugging. */
  private async sweep(userId: string) {
    await this.prisma.confirmation
      .deleteMany({ where: { userId, expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => undefined);
  }
}

function transportsOf(value: string | null): AuthenticatorTransportFuture[] | undefined {
  const list = value?.split(',').filter(Boolean) as AuthenticatorTransportFuture[] | undefined;
  return list?.length ? list : undefined;
}
