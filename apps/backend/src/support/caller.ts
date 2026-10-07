import { randomBytes } from 'node:crypto';
import type { SupportAudience } from '@prisma/client';
import type { Request, Response } from 'express';
import type { AuthUser } from 'src/common/types';

// Who is talking to support (CHAT_SUPPORT.md §1.1). Every /support route is @AllowAnonymous(), so AccessGuard puts the
// user on the request when there is a session but returns before its INACTIVE and super-admin-2FA checks: they are
// re-applied here as `restricted` (an audience, but no account lookups), never as a refusal, so a deactivated user can
// still reach the team.

export const VISITOR_COOKIE = 'mb_support_visitor';
const VISITOR_COOKIE_DAYS = 30;
const VISITOR_ID = /^[A-Za-z0-9_-]{43}$/;

export interface SupportCaller {
  audience: SupportAudience;
  /** Deactivated, or a super admin without 2FA or a passkey: no data tools. */
  restricted: boolean;
  /** Signed in: the session's user. */
  user: AuthUser | null;
  /** Signed out: the cookie's id. */
  visitorId: string | null;
  /** The client IP clientIp() settled on (x-client-ip), for the visitor limits and Turnstile. */
  ip: string | null;
}

/** Staff answer support; they never hand a conversation off. */
export const RESPONDER_AUDIENCES: SupportAudience[] = ['ADMIN', 'SUPER_ADMIN'];

export const canHandoff = (caller: Pick<SupportCaller, 'audience'>) => !RESPONDER_AUDIENCES.includes(caller.audience);

/** Which conversations are the caller's. */
export const ownerOf = (caller: SupportCaller) =>
  caller.user ? { userId: caller.user.userId } : { visitorId: caller.visitorId as string };

export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    if (part.slice(0, at).trim() === name) {
      try {
        return decodeURIComponent(part.slice(at + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function audienceOf(user: AuthUser): SupportAudience {
  switch (user.role) {
    case 'CUSTOMER':
      return 'CUSTOMER';
    case 'MARKETER':
      return 'MARKETER';
    case 'SUPER_ADMIN':
      return 'SUPER_ADMIN';
    // ADMIN, and the SYSTEM actor (which never signs in), get the admin view.
    default:
      return 'ADMIN';
  }
}

export function isRestricted(user: AuthUser): boolean {
  if (user.status === 'INACTIVE') return true;
  return user.role === 'SUPER_ADMIN' && !user.twoFactorEnabled && !user.hasPasskey;
}

/**
 * Resolves the caller. A visitor without the cookie gets a new id, set on `response` when one is given (httpOnly,
 * host-only, 30 days: it lives on the API's host, which is why every support call goes direct to the API).
 */
export function resolveCaller(request: Request & { user?: AuthUser }, response?: Response): SupportCaller {
  const ipHeader = request.headers['x-client-ip'];
  const ip = (Array.isArray(ipHeader) ? ipHeader[0] : ipHeader) ?? null;
  const user = request.user ?? null;
  if (user) {
    return { audience: audienceOf(user), restricted: isRestricted(user), user, visitorId: null, ip };
  }

  let visitorId = readCookie(request.headers.cookie, VISITOR_COOKIE);
  if (!visitorId || !VISITOR_ID.test(visitorId)) {
    visitorId = randomBytes(32).toString('base64url');
    response?.cookie(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      // Browsers treat localhost as secure, so this holds in development too.
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: VISITOR_COOKIE_DAYS * 24 * 60 * 60 * 1000,
    });
  }
  return { audience: 'ANONYMOUS', restricted: false, user: null, visitorId, ip };
}
