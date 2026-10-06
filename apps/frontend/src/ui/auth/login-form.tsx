"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon, icons } from "@/components/icon";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import InputPassword from "@/components/ui/input-password";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  signInEmail,
  signInPhone,
  sendEmailOtpSignIn,
  signInEmailOtp,
  signInMagicLink,
  signInPasskey,
} from "@/lib/mutations/user/auth";
import getErrorMessage from "./utils";
import { PHONE_AUTH_ENABLED } from "@/config/features";
import { normalizeNgPhone } from "@microbuilt/shared";

/* ---------- schemas ---------- */

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const phoneSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required.")
    .refine((v) => normalizeNgPhone(v) !== null, "Enter a valid Nigerian phone number."),
  password: z.string().min(1, "Password is required."),
});

const emailCodeStep1Schema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

const emailCodeStep2Schema = z.object({
  otp: z.string().length(6, "Code must be 6 digits.").regex(/^\d{6}$/, "Code must be 6 digits."),
});

const magicLinkSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

/* ---------- error helpers ---------- */

const ADMIN_MSG = "Admins sign in with a password or a passkey";

function isEmailNotVerified(error: unknown): boolean {
  return error instanceof Error && error.message.includes("EMAIL_NOT_VERIFIED");
}

function isForbidden(error: unknown): boolean {
  return error instanceof Error && error.message.includes("FORBIDDEN");
}

/* ---------- tab type ---------- */

type Tab = "email" | "phone" | "email-code" | "magic-link";

/* ---------- component ---------- */

export default function LoginForm() {
  const [activeTab, setActiveTab] = useState<Tab>("email");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const sessionExpired = searchParams.has("expired");

  function onSignInSuccess() {
    toast.success("Login successful");
    router.push(next);
  }

  function onError(error: unknown, fallback: string) {
    if (isEmailNotVerified(error)) {
      // Redirect to verify-code with the email from the form
      const email =
        activeTab === "email" ? emailForm.getValues("email") :
        activeTab === "email-code" ? emailCodeEmail :
        activeTab === "magic-link" ? magicLinkForm.getValues("email") :
        "";
      router.push(`/verify-code?email=${encodeURIComponent(email)}`);
      return;
    }
    if (isForbidden(error)) {
      setGlobalError(ADMIN_MSG);
      return;
    }
    setGlobalError(getErrorMessage(error, fallback));
  }

  /* ---- Email tab ---- */
  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "", password: "" },
  });
  const emailMut = useMutation(signInEmail);

  function onEmailSubmit(values: z.infer<typeof emailSchema>) {
    setGlobalError(null);
    emailMut.mutate(
      { email: values.email, password: values.password },
      { onSuccess: onSignInSuccess, onError: (e) => onError(e, "Login failed") },
    );
  }

  /* ---- Phone tab ---- */
  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "", password: "" },
  });
  const phoneMut = useMutation(signInPhone);
  const [phoneOtpStep, setPhoneOtpStep] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const phoneOtpMut = useMutation({
    ...signInEmailOtp, // Reuse — phone OTP verification uses the same endpoint
  });

  function onPhoneSubmit(values: z.infer<typeof phoneSchema>) {
    setGlobalError(null);
    const normalized = normalizeNgPhone(values.phone) ?? values.phone;
    phoneMut.mutate(
      { phoneNumber: normalized, password: values.password },
      {
        onSuccess: onSignInSuccess,
        onError: (e) => {
          // If phone is unverified, send OTP then verify
          if (isEmailNotVerified(e)) {
            setPendingPhone(normalized);
            setPhoneOtpStep(true);
            toast.info("Phone not verified. Enter the OTP sent to your phone.");
          } else {
            onError(e, "Login failed");
          }
        },
      },
    );
  }

  /* ---- Email code tab ---- */
  const [emailCodeStep, setEmailCodeStep] = useState<1 | 2>(1);
  const [emailCodeEmail, setEmailCodeEmail] = useState("");

  const emailCodeStep1Form = useForm<z.infer<typeof emailCodeStep1Schema>>({
    resolver: zodResolver(emailCodeStep1Schema),
    defaultValues: { email: "" },
  });
  const sendEmailCodeMut = useMutation(sendEmailOtpSignIn);

  function onSendEmailCode(values: z.infer<typeof emailCodeStep1Schema>) {
    setGlobalError(null);
    sendEmailCodeMut.mutate(
      { email: values.email },
      {
        onSuccess: () => {
          setEmailCodeEmail(values.email);
          setEmailCodeStep(2);
          toast.success("Code sent to your email");
        },
        onError: (e) => onError(e, "Failed to send code"),
      },
    );
  }

  const emailCodeStep2Form = useForm<z.infer<typeof emailCodeStep2Schema>>({
    resolver: zodResolver(emailCodeStep2Schema),
    defaultValues: { otp: "" },
  });
  const emailCodeVerifyMut = useMutation(signInEmailOtp);

  function onVerifyEmailCode(values: z.infer<typeof emailCodeStep2Schema>) {
    setGlobalError(null);
    emailCodeVerifyMut.mutate(
      { email: emailCodeEmail, otp: values.otp },
      { onSuccess: onSignInSuccess, onError: (e) => onError(e, "Login failed") },
    );
  }

  /* ---- Magic link tab ---- */
  const magicLinkForm = useForm<z.infer<typeof magicLinkSchema>>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: "" },
  });
  const magicLinkMut = useMutation(signInMagicLink);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  function onMagicLinkSubmit(values: z.infer<typeof magicLinkSchema>) {
    setGlobalError(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    magicLinkMut.mutate(
      { email: values.email, callbackURL: `${origin}/dashboard` },
      {
        onSuccess: () => {
          setMagicLinkSent(true);
          toast.success("Check your inbox");
        },
        onError: (e) => onError(e, "Failed to send magic link"),
      },
    );
  }

  /* ---- Passkey ---- */
  const passkeyMut = useMutation(signInPasskey);

  function onPasskey() {
    setGlobalError(null);
    passkeyMut.mutate(
      { autoFill: true },
      { onSuccess: onSignInSuccess, onError: (e) => onError(e, "Passkey sign-in failed") },
    );
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setGlobalError(null);
    if (tab !== "email-code") {
      setEmailCodeStep(1);
      setEmailCodeEmail("");
    }
    if (tab !== "magic-link") setMagicLinkSent(false);
    if (tab !== "phone") {
      setPhoneOtpStep(false);
      setPhoneOtp("");
      setPendingPhone("");
    }
  }

  const linkCls = "text-sm font-medium text-primary hover:underline";

  return (
    <div className="w-full space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-normal">Log in</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Welcome back. Choose your preferred sign-in method to continue.
        </p>
      </div>

      {/* Global error */}
      {sessionExpired && !globalError && (
        <Alert className="py-2">
          <AlertDescription className="text-xs">Your session has ended. Sign in again to continue.</AlertDescription>
        </Alert>
      )}

      {globalError && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{globalError}</AlertDescription>
        </Alert>
      )}

      {/* ---- Email tab ---- */}
      {activeTab === "email" && (
        <Form {...emailForm}>
          <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-3.5">
            <FormField
              control={emailForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium">Email</FormLabel>
                    {PHONE_AUTH_ENABLED && (
                    <button type="button" className={linkCls} onClick={() => switchTab("phone")}>
                      Use phone number instead
                    </button>
                    )}
                  </div>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@company.com"
                      autoComplete="username webauthn"
                      className="h-11 bg-background"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={emailForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Password</FormLabel>
                  <FormControl>
                    <InputPassword
                      placeholder="Enter your password"
                      className="h-11"
                      showStrength={false}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-primary hover:underline"
                aria-label="Forgot Password"
              >
                Forgot password?
              </Link>
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={emailMut.isPending}
              disabled={emailMut.isPending}
            >
              Sign in
            </Button>
          </form>
        </Form>
      )}

      {/* ---- Phone tab ---- */}
      {activeTab === "phone" && !phoneOtpStep && (
        <Form {...phoneForm}>
          <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-3.5">
            <FormField
              control={phoneForm.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium">Phone</FormLabel>
                    <button type="button" className={linkCls} onClick={() => switchTab("email")}>
                      Use email instead
                    </button>
                  </div>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="08012345678"
                      className="h-11 bg-background"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={phoneForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Password</FormLabel>
                  <FormControl>
                    <InputPassword
                      placeholder="Enter your password"
                      className="h-11"
                      showStrength={false}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-primary hover:underline"
                aria-label="Forgot Password"
              >
                Forgot password?
              </Link>
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={phoneMut.isPending}
              disabled={phoneMut.isPending}
            >
              Sign in
            </Button>
          </form>
        </Form>
      )}

      {/* Phone OTP verification step */}
      {activeTab === "phone" && phoneOtpStep && (
        <div className="space-y-3.5">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <span className="font-medium text-foreground">{pendingPhone}</span>.
          </p>
          <Input
            placeholder="000000"
            value={phoneOtp}
            onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            autoComplete="one-time-code"
            className="h-11"
          />
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              phoneOtpMut.mutate(
                { email: `phone+${pendingPhone}@phone.microbuiltprime.com`, otp: phoneOtp },
                { onSuccess: onSignInSuccess, onError: (e) => onError(e, "Verification failed") },
              );
            }}
            disabled={phoneOtp.length < 6 || phoneOtpMut.isPending}
            loading={phoneOtpMut.isPending}
          >
            Verify
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setPhoneOtpStep(false);
              setPhoneOtp("");
            }}
          >
            Back to phone login
          </Button>
        </div>
      )}

      {/* ---- Email code tab ---- */}
      {activeTab === "email-code" && emailCodeStep === 1 && (
        <Form {...emailCodeStep1Form}>
          <form onSubmit={emailCodeStep1Form.handleSubmit(onSendEmailCode)} className="space-y-3.5">
            <FormField
              control={emailCodeStep1Form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@company.com"
                      autoComplete="username webauthn"
                      className="h-11 bg-background"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={sendEmailCodeMut.isPending}
              disabled={sendEmailCodeMut.isPending}
            >
              Send code
            </Button>
          </form>
        </Form>
      )}

      {activeTab === "email-code" && emailCodeStep === 2 && (
        <Form {...emailCodeStep2Form}>
          <form onSubmit={emailCodeStep2Form.handleSubmit(onVerifyEmailCode)} className="space-y-3.5">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to{" "}
              <span className="font-medium text-foreground">{emailCodeEmail}</span>.
            </p>
            <FormField
              control={emailCodeStep2Form.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="000000"
                      maxLength={6}
                      autoComplete="one-time-code"
                      className="h-11"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={emailCodeVerifyMut.isPending}
              disabled={emailCodeVerifyMut.isPending}
            >
              Sign in
            </Button>
            <div className="text-center">
              <span className="text-xs text-muted-foreground">Didn&apos;t receive the code? </span>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs font-semibold text-primary"
                onClick={() =>
                  sendEmailCodeMut.mutate(
                    { email: emailCodeEmail },
                    { onSuccess: () => toast.success("Code resent"), onError: (e) => onError(e, "Failed to resend code") },
                  )
                }
                disabled={sendEmailCodeMut.isPending}
              >
                Resend code
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setEmailCodeStep(1);
                setEmailCodeEmail("");
              }}
            >
              Change email
            </Button>
          </form>
        </Form>
      )}

      {/* ---- Magic link tab ---- */}
      {activeTab === "magic-link" && !magicLinkSent && (
        <Form {...magicLinkForm}>
          <form onSubmit={magicLinkForm.handleSubmit(onMagicLinkSubmit)} className="space-y-3.5">
            <FormField
              control={magicLinkForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@company.com"
                      autoComplete="username webauthn"
                      className="h-11 bg-background"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={magicLinkMut.isPending}
              disabled={magicLinkMut.isPending}
            >
              Send magic link
            </Button>
          </form>
        </Form>
      )}

      {activeTab === "magic-link" && magicLinkSent && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
            <Icon icon={icons.mail} size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Check your inbox</h2>
            <p className="text-sm text-muted-foreground">
              We&apos;ve sent a sign-in link to your email. Click it to continue.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setMagicLinkSent(false)}
          >
            Use a different method
          </Button>
        </div>
      )}

      {/* ---- Passkey button (always visible) ---- */}
      <div className="space-y-3">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={onPasskey}
          loading={passkeyMut.isPending}
          disabled={passkeyMut.isPending}
        >
          <Icon icon={icons.lock} size={16} className="mr-2" />
          Sign in with passkey
        </Button>
      </div>

      {/* ---- Footer ---- */}
      <div className="text-center text-xs text-muted-foreground">
        {"Don't have a MicroBuilt account?"}{" "}
        <Link
          href="/sign-up"
          className="text-xs font-semibold text-primary hover:underline"
          aria-label="Sign up"
        >
          Sign up
        </Link>
      </div>

      <div className="space-y-3 text-center">
        {activeTab === "email" ? (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => switchTab("email-code")}>
                Email me a code
              </Button>
              <Button type="button" variant="outline" onClick={() => switchTab("magic-link")}>
                Email me a magic link
              </Button>
            </div>
          </>
        ) : activeTab === "phone" ? null : (
          <button type="button" className={linkCls} onClick={() => switchTab("email")}>
            Sign in with password instead
          </button>
        )}
      </div>
    </div>
  );
}
