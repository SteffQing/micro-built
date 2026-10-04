// Phone sign-up, sign-in and password reset need SMS (Termii). Off until NEXT_PUBLIC_PHONE_AUTH=true is set.
export const PHONE_AUTH_ENABLED = process.env.NEXT_PUBLIC_PHONE_AUTH === "true";
