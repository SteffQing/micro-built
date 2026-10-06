// Lifetimes the auth config enforces and the emails and texts quote. No imports here, so mail
// and SMS code (and their Jest specs) can use them without loading better-auth (ESM-only, D14).

/** Email and SMS codes (verification, sign-in, password reset, email change). */
export const CODE_TTL_MINUTES = 10;
/** A second-factor code sent by email or SMS. */
export const TWO_FACTOR_CODE_TTL_MINUTES = 5;
export const MAGIC_LINK_TTL_MINUTES = 10;
/** better-auth's default for a password reset link. */
export const RESET_LINK_TTL_MINUTES = 60;

export const SUPER_ADMIN_SIGN_IN_MESSAGE = 'Super admins sign in with a passkey, or a password and 2FA';
export const SUPER_ADMIN_KEEPS_FACTOR_MESSAGE =
  'Super admins keep two-factor authentication or a passkey: add the other before removing this one';
export const SUPER_ADMIN_USE_PASSKEY_MESSAGE = 'Sign in with your passkey, or turn on two-factor authentication'
