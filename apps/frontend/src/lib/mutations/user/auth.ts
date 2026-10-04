import { signIn, signUp, signOut, emailOtp, phoneNumber, twoFactor, resetPassword, requestPasswordReset } from "@/lib/auth-client";
import { mutationOptions } from "@tanstack/react-query";
import { normalizeNgPhone, placeholderEmail } from "@microbuilt/shared";

// Normalise and assert: the caller already validated the phone format,
// so normalizeNgPhone always returns a string here.
function norm(phone: string): string {
  return normalizeNgPhone(phone) ?? phone;
}

// Sign-up with email (optional phone).
export const signUpEmail = mutationOptions({
  mutationKey: ["auth", "sign-up", "email"],
  mutationFn: async (data: { name: string; email: string; password: string; phoneNumber?: string }) => {
    const res = await signUp.email({
      name: data.name,
      email: data.email,
      password: data.password,
      phoneNumber: data.phoneNumber ? norm(data.phoneNumber) : undefined,
    } as Parameters<typeof signUp.email>[0]);
    if (res.error) throw new Error(res.error.message ?? "Sign-up failed");
    return res.data;
  },
});

// Sign-up phone-only (placeholder email).
export const signUpPhone = mutationOptions({
  mutationKey: ["auth", "sign-up", "phone"],
  mutationFn: async (data: { name: string; phoneNumber: string; password: string }) => {
    const normalized = norm(data.phoneNumber);
    const res = await signUp.email({
      name: data.name,
      email: placeholderEmail(normalized),
      password: data.password,
      phoneNumber: normalized,
    } as Parameters<typeof signUp.email>[0]);
    if (res.error) throw new Error(res.error.message ?? "Sign-up failed");
    return res.data;
  },
});

// Send phone OTP.
export const sendPhoneOtp = mutationOptions({
  mutationKey: ["auth", "phone", "send-otp"],
  mutationFn: async (data: { phoneNumber: string }) => {
    const res = await phoneNumber.sendOtp({ phoneNumber: norm(data.phoneNumber) } as Parameters<typeof phoneNumber.sendOtp>[0]);
    if (res.error) throw new Error(res.error.message ?? "Failed to send OTP");
    return res.data;
  },
});

// Verify phone OTP.
export const verifyPhoneOtp = mutationOptions({
  mutationKey: ["auth", "phone", "verify-otp"],
  mutationFn: async (data: { phoneNumber: string; code: string }) => {
    const res = await phoneNumber.verify({ phoneNumber: norm(data.phoneNumber), code: data.code } as Parameters<typeof phoneNumber.verify>[0]);
    if (res.error) throw new Error(res.error.message ?? "Verification failed");
    return res.data;
  },
});

// Sign-in with email + password.
export const signInEmail = mutationOptions({
  mutationKey: ["auth", "sign-in", "email"],
  mutationFn: async (data: { email: string; password: string }) => {
    const res = await signIn.email({ email: data.email, password: data.password });
    if (res.error) throw new Error(res.error.message ?? "Login failed");
    return res.data;
  },
});

// Sign-in with phone + password.
export const signInPhone = mutationOptions({
  mutationKey: ["auth", "sign-in", "phone"],
  mutationFn: async (data: { phoneNumber: string; password: string }) => {
    const res = await signIn.phoneNumber({ phoneNumber: norm(data.phoneNumber), password: data.password } as Parameters<typeof signIn.phoneNumber>[0]);
    if (res.error) throw new Error(res.error.message ?? "Login failed");
    return res.data;
  },
});

// Send email OTP for sign-in.
export const sendEmailOtpSignIn = mutationOptions({
  mutationKey: ["auth", "email-otp", "send-sign-in"],
  mutationFn: async (data: { email: string }) => {
    const res = await emailOtp.sendVerificationOtp({ email: data.email, type: "sign-in" });
    if (res.error) throw new Error(res.error.message ?? "Failed to send code");
    return res.data;
  },
});

// Sign-in with email OTP.
export const signInEmailOtp = mutationOptions({
  mutationKey: ["auth", "sign-in", "email-otp"],
  mutationFn: async (data: { email: string; otp: string }) => {
    const res = await signIn.emailOtp({ email: data.email, otp: data.otp });
    if (res.error) throw new Error(res.error.message ?? "Login failed");
    return res.data;
  },
});

// Sign-in with magic link.
export const signInMagicLink = mutationOptions({
  mutationKey: ["auth", "sign-in", "magic-link"],
  mutationFn: async (data: { email: string; callbackURL?: string }) => {
    const res = await signIn.magicLink({ email: data.email, callbackURL: data.callbackURL });
    if (res.error) throw new Error(res.error.message ?? "Magic link failed");
    return res.data;
  },
});

// Sign-in with passkey.
export const signInPasskey = mutationOptions({
  mutationKey: ["auth", "sign-in", "passkey"],
  mutationFn: async (data?: { autoFill?: boolean }) => {
    const res = await signIn.passkey({ autoFill: data?.autoFill });
    if (res.error) throw new Error(res.error.message ?? "Passkey sign-in failed");
    return res.data;
  },
});

// Verify email with OTP.
export const verifyEmail = mutationOptions({
  mutationKey: ["auth", "email-otp", "verify"],
  mutationFn: async (data: { email: string; otp: string }) => {
    const res = await emailOtp.verifyEmail({ email: data.email, otp: data.otp });
    if (res.error) throw new Error(res.error.message ?? "Verification failed");
    return res.data;
  },
});

// Resend email verification.
export const resendVerification = mutationOptions({
  mutationKey: ["auth", "email-otp", "resend"],
  mutationFn: async (data: { email: string }) => {
    const res = await emailOtp.sendVerificationOtp({ email: data.email, type: "email-verification" });
    if (res.error) throw new Error(res.error.message ?? "Failed to resend code");
    return res.data;
  },
});

// Forgot password (email).
export const forgotPassword = mutationOptions({
  mutationKey: ["auth", "forgot-password"],
  mutationFn: async (data: { email: string; redirectTo: string }) => {
    const res = await requestPasswordReset({ email: data.email, redirectTo: data.redirectTo });
    if (res.error) throw new Error(res.error.message ?? "Reset request failed");
    return res.data;
  },
});

// Forgot password (phone).
export const forgotPasswordPhone = mutationOptions({
  mutationKey: ["auth", "forgot-password", "phone"],
  mutationFn: async (data: { phoneNumber: string }) => {
    const res = await phoneNumber.requestPasswordReset({ phoneNumber: norm(data.phoneNumber) } as Parameters<typeof phoneNumber.requestPasswordReset>[0]);
    if (res.error) throw new Error(res.error.message ?? "Reset request failed");
    return res.data;
  },
});

// Reset password (email token flow).
export const doResetPassword = mutationOptions({
  mutationKey: ["auth", "reset-password"],
  mutationFn: async (data: { newPassword: string; token: string }) => {
    const res = await resetPassword({ newPassword: data.newPassword, token: data.token });
    if (res.error) throw new Error(res.error.message ?? "Password reset failed");
    return res.data;
  },
});

// Reset password (phone OTP flow).
export const resetPasswordPhone = mutationOptions({
  mutationKey: ["auth", "reset-password", "phone"],
  mutationFn: async (data: { phoneNumber: string; otp: string; newPassword: string }) => {
    const res = await phoneNumber.resetPassword({ phoneNumber: norm(data.phoneNumber), otp: data.otp, newPassword: data.newPassword } as Parameters<typeof phoneNumber.resetPassword>[0]);
    if (res.error) throw new Error(res.error.message ?? "Password reset failed");
    return res.data;
  },
});

// 2FA: verify TOTP code.
export const verifyTwoFactorTotp = mutationOptions({
  mutationKey: ["auth", "2fa", "verify-totp"],
  mutationFn: async (data: { code: string }) => {
    const res = await twoFactor.verifyTotp({ code: data.code });
    if (res.error) throw new Error(res.error.message ?? "2FA verification failed");
    return res.data;
  },
});

// 2FA: send OTP.
export const sendTwoFactorOtp = mutationOptions({
  mutationKey: ["auth", "2fa", "send-otp"],
  mutationFn: async () => {
    const res = await twoFactor.sendOtp();
    if (res.error) throw new Error(res.error.message ?? "Failed to send 2FA code");
    return res.data;
  },
});

// 2FA: verify OTP.
export const verifyTwoFactorOtp = mutationOptions({
  mutationKey: ["auth", "2fa", "verify-otp"],
  mutationFn: async (data: { code: string }) => {
    const res = await twoFactor.verifyOtp({ code: data.code });
    if (res.error) throw new Error(res.error.message ?? "2FA verification failed");
    return res.data;
  },
});

// 2FA: verify backup code.
export const verifyTwoFactorBackup = mutationOptions({
  mutationKey: ["auth", "2fa", "verify-backup"],
  mutationFn: async (data: { code: string }) => {
    const res = await twoFactor.verifyBackupCode({ code: data.code });
    if (res.error) throw new Error(res.error.message ?? "Backup code failed");
    return res.data;
  },
});

// 2FA: enable.
export const enableTwoFactor = mutationOptions({
  mutationKey: ["auth", "2fa", "enable"],
  mutationFn: async (data: { password: string }) => {
    const res = await twoFactor.enable({ password: data.password });
    if (res.error) throw new Error(res.error.message ?? "2FA enable failed");
    return res.data;
  },
});

// 2FA: disable.
export const disableTwoFactor = mutationOptions({
  mutationKey: ["auth", "2fa", "disable"],
  mutationFn: async (data: { password: string }) => {
    const res = await twoFactor.disable({ password: data.password });
    if (res.error) throw new Error(res.error.message ?? "2FA disable failed");
    return res.data;
  },
});

// Sign out.
export const signOutMutation = mutationOptions({
  mutationKey: ["auth", "sign-out"],
  mutationFn: async () => {
    const res = await signOut();
    if (res.error) throw new Error(res.error.message ?? "Sign out failed");
    return res.data;
  },
});
