"use client";

import { createAuthClient } from "better-auth/react";
import { authClientOptions } from "@microbuilt/backend/auth-client";

export const authClient = createAuthClient(
  authClientOptions({
    onTwoFactorRedirect: () => window.location.assign("/two-factor"),
  }),
);

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  emailOtp,
  phoneNumber,
  twoFactor,
  passkey,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  changePassword,
  resetPassword,
  requestPasswordReset,
} = authClient;

export type { AuthSession, AuthUser } from "@microbuilt/backend/auth-client";
