// The frontend's typed auth client, published as `@microbuilt/backend/auth-client` (D15).
// Runtime imports here are client-side only; the server config arrives as a type, so no server
// code reaches the browser bundle and the backend needs no React:
//
//   import { createAuthClient } from 'better-auth/react';
//   import { authClientOptions } from '@microbuilt/backend/auth-client';
//   export const authClient = createAuthClient(authClientOptions({ onTwoFactorRedirect }));
import {
  emailOTPClient,
  magicLinkClient,
  phoneNumberClient,
  twoFactorClient,
} from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import type { Auth } from './auth.config';

export type { Auth };
export type AuthSession = Auth['$Infer']['Session'];
export type AuthUser = AuthSession['user'];

export interface AuthClientOptions {
  /** Runs when a password sign-in stops for the second factor. */
  onTwoFactorRedirect?: () => void | Promise<void>;
}

// One client plugin per server plugin in auth.config.ts (bearer, haveIBeenPwned and openAPI
// need none). The server declares no additionalFields (type/status come from GET /user), so
// inferAdditionalFields would add nothing. No baseURL: the browser calls /api/auth on its own
// origin, which Vercel proxies to the API (D8).
export function authClientOptions(options: AuthClientOptions = {}) {
  return {
    plugins: [
      emailOTPClient(),
      magicLinkClient(),
      phoneNumberClient(),
      twoFactorClient({ onTwoFactorRedirect: options.onTwoFactorRedirect }),
      passkeyClient(),
    ],
  };
}
