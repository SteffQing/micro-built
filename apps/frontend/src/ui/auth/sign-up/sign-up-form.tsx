"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import InputPassword from "@/components/ui/input-password";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "sonner";
import {
  signUpEmail,
  signUpPhone,
  sendPhoneOtp,
  verifyPhoneOtp,
  signInPhone,
} from "@/lib/mutations/user/auth";
import {
  normalizeNgPhone,
  placeholderEmail,
  isPlaceholderEmail,
} from "@microbuilt/shared";
import getErrorMessage from "../utils";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

// The new mutations throw Error (not AxiosError), so we need a helper
// that handles both shapes.
function getError(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return getErrorMessage(error, fallback);
}

/* ------------------------------------------------------------------ */
/*  Schemas                                                           */
/* ------------------------------------------------------------------ */

const signupSchema = z.object({
  name: z.string().min(2, {
    message: "Full name must be at least 2 characters.",
  }),
  email: z
    .string()
    .optional()
    .refine(
      (val) =>
        val === undefined ||
        val === "" ||
        z.string().email().safeParse(val).success,
      {
        message: "Please enter a valid email address.",
      },
    ),
  contact: z
    .string()
    .optional()
    .refine(
      (val) => val === undefined || val === "" || /^[0-9]{11}$/.test(val),
      {
        message: "Please enter a valid contact number.",
      },
    ),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." })
    .regex(/[a-z]/, {
      message: "Password must contain at least one lowercase letter.",
    })
    .regex(/[A-Z]/, {
      message: "Password must contain at least one uppercase letter.",
    })
    .regex(/\d/, { message: "Password must contain at least one number." })
    .regex(/[@$!%*?&]/, {
      message:
        "Password must contain at least one special character (@$!%*?&).",
    }),
  agreeToTerms: z.boolean().refine((value) => value, {
    message: "You must agree to the terms and conditions.",
  }),
});

const phoneOtpSchema = z.object({
  code: z.string().length(6, {
    message: "OTP must be exactly 6 digits.",
  }),
});

type SignUpFormValues = z.infer<typeof signupSchema>;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "phone-otp">("form");
  const [phoneData, setPhoneData] = useState<{
    phoneNumber: string;
    password: string;
  } | null>(null);

  /* ---- mutations ---- */
  const emailSignupMut = useMutation(signUpEmail);
  const phoneSignupMut = useMutation(signUpPhone);
  const sendOtpMut = useMutation(sendPhoneOtp);
  const resendOtpMut = useMutation(sendPhoneOtp);
  const verifyOtpMut = useMutation(verifyPhoneOtp);
  const signInMut = useMutation(signInPhone);

  /* ---- sign-up form ---- */
  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: undefined,
      contact: undefined,
      password: "",
      agreeToTerms: false,
    },
  });

  const agreeToTerms = form.watch("agreeToTerms");

  async function onSubmit(values: SignUpFormValues) {
    const { agreeToTerms: agreed, contact, email, ...rest } = values;
    if (!agreed) return;

    const hasRealEmail = !!email && !isPlaceholderEmail(email);

    if (hasRealEmail) {
      // Email sign-up path → redirect to email verification
      emailSignupMut.mutateAsync(
        {
          name: rest.name,
          email,
          password: rest.password,
          phoneNumber: contact
            ? (normalizeNgPhone(contact) ?? contact)
            : undefined,
        },
        {
          onSuccess: () => {
            router.push(
              `/verify-code?email=${encodeURIComponent(email)}`,
            );
          },
        },
      );
    } else if (contact) {
      // Phone-only sign-up path → create account, send OTP
      const normalizedPhone = normalizeNgPhone(contact) ?? contact;
      phoneSignupMut.mutateAsync(
        {
          name: rest.name,
          phoneNumber: normalizedPhone,
          password: rest.password,
        },
        {
          onSuccess: () => {
            sendOtpMut.mutateAsync(
              { phoneNumber: normalizedPhone },
              {
                onSuccess: () => {
                  setPhoneData({
                    phoneNumber: normalizedPhone,
                    password: rest.password,
                  });
                  setStep("phone-otp");
                },
              },
            );
          },
        },
      );
    }
  }

  /* ---- phone OTP form ---- */
  const otpForm = useForm<z.infer<typeof phoneOtpSchema>>({
    resolver: zodResolver(phoneOtpSchema),
    defaultValues: { code: "" },
  });

  const otpCode = otpForm.watch("code");
  const isOtpValid = otpCode.length === 6 && /^\d{6}$/.test(otpCode);

  async function onVerifyOtp(values: z.infer<typeof phoneOtpSchema>) {
    if (!phoneData || !isOtpValid) return;

    verifyOtpMut.mutateAsync(
      {
        phoneNumber: phoneData.phoneNumber,
        code: values.code,
      },
      {
        onSuccess: () => {
          signInMut.mutateAsync(
            {
              phoneNumber: phoneData.phoneNumber,
              password: phoneData.password,
            },
            {
              onSuccess: () => {
                toast.success("Account verified successfully");
                router.push("/dashboard");
              },
            },
          );
        },
      },
    );
  }

  function handleResendOtp() {
    if (!phoneData) return;
    resendOtpMut.mutate({ phoneNumber: phoneData.phoneNumber });
  }

  /* ---- derived UI state ---- */
  const formPending =
    emailSignupMut.isPending ||
    phoneSignupMut.isPending ||
    sendOtpMut.isPending;
  const formError =
    emailSignupMut.error ??
    phoneSignupMut.error ??
    sendOtpMut.error;
  const isFormError =
    emailSignupMut.isError ||
    phoneSignupMut.isError ||
    sendOtpMut.isError;

  const otpPending = verifyOtpMut.isPending || signInMut.isPending;
  const otpError = verifyOtpMut.error ?? signInMut.error;
  const isOtpError = verifyOtpMut.isError || signInMut.isError;

  /* ---- render: phone OTP step ---- */
  if (step === "phone-otp") {
    return (
      <div className="w-full space-y-5">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase text-primary">
            Phone verification
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">
            Verify your phone
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-foreground">
              {phoneData?.phoneNumber}
            </span>
            .
          </p>
        </div>

        {(isOtpError || resendOtpMut.isError) && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">
              {isOtpError &&
                getError(
                  otpError,
                  "Verification failed. Please try again.",
                )}
              {resendOtpMut.isError &&
                getError(
                  resendOtpMut.error,
                  "Failed to resend code. Please try again.",
                )}
            </AlertDescription>
          </Alert>
        )}

        <Form {...otpForm}>
          <form
            onSubmit={otpForm.handleSubmit(onVerifyOtp)}
            className="space-y-4"
          >
            <FormField
              control={otpForm.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Verification code
                  </FormLabel>
                  <FormControl>
                    <div className="flex justify-center">
                      <InputOTP maxLength={6} {...field}>
                        <InputOTPGroup className="space-x-2 sm:space-x-3">
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="text-center">
              <span className="text-xs text-muted-foreground">
                Didn&apos;t receive the code?{" "}
              </span>
              <Button
                type="button"
                onClick={handleResendOtp}
                loading={resendOtpMut.isPending}
                disabled={resendOtpMut.isPending}
                variant="link"
                className="h-auto p-0 text-xs font-semibold text-primary"
              >
                Resend code
              </Button>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!isOtpValid || otpPending}
              loading={otpPending}
            >
              Verify &amp; sign in
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              Want to use a different number?{" "}
              <button
                type="button"
                onClick={() => setStep("form")}
                className="font-semibold text-primary hover:underline"
              >
                Go back
              </button>
            </div>
          </form>
        </Form>
      </div>
    );
  }

  /* ---- render: sign-up form ---- */
  return (
    <div className="w-full space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase text-primary">
          Access request
        </p>
        <h1 className="text-2xl font-semibold tracking-normal">
          Create account
        </h1>
        <p className="text-sm leading-5 text-muted-foreground">
          Set up your MicroBuilt workspace access.
        </p>
      </div>

      {isFormError && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">
            {getError(formError, "Signup failed. Please try again.")}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">Full Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter full name"
                    className="h-10 bg-background"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  Email Address
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    className="h-10 bg-background"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contact"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  Phone Numbers
                </FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="08012345678"
                    className="h-10 bg-background"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  Create Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <InputPassword
                      placeholder="Enter your password"
                      className="h-10 bg-background"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="agreeToTerms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-2 space-y-0">
                <FormControl className="flex items-center justify-center p-1">
                  <Checkbox
                    className="mt-0.5 h-4 w-4"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="cursor-pointer text-xs font-normal leading-5 text-muted-foreground">
                    I agree to MicroBuilt&apos;s{" "}
                    <Link
                      href="/terms"
                      className="font-semibold text-primary hover:underline"
                      aria-label="Terms and Conditions"
                    >
                      terms and conditions
                    </Link>
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={!agreeToTerms || formPending}
            loading={formPending}
          >
            Create account
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            Already have a MicroBuilt account?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:underline"
              aria-label="Login"
            >
              Log in
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
