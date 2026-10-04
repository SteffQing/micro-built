"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import {
  forgotPassword,
  forgotPasswordPhone,
  resetPasswordPhone,
} from "@/lib/mutations/user/auth";
import { PHONE_AUTH_ENABLED } from "@/config/features";
import { normalizeNgPhone } from "@microbuilt/shared";

// Error helper — mutations throw Error (not AxiosError)
function getError(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

/* ---- Schemas ---- */

const emailSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

const phoneSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required.")
    .refine(
      (v) => normalizeNgPhone(v) !== null,
      "Enter a valid Nigerian phone number.",
    ),
});

const phoneResetSchema = z
  .object({
    otp: z
      .string()
      .length(6, { message: "OTP must be exactly 6 digits." })
      .regex(/^\d{6}$/, "OTP must be exactly 6 digits."),
    newPassword: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." })
      .max(50, {
        message: "Password must be shorter than or equal to 50 characters.",
      })
      .regex(/[a-z]/, {
        message: "Password must contain at least one lowercase letter.",
      })
      .regex(/[A-Z]/, {
        message: "Password must contain at least one uppercase letter.",
      })
      .regex(/\d/, {
        message: "Password must contain at least one number.",
      })
      .regex(/[@$!%*?&]/, {
        message:
          "Password must contain at least one special character (@$!%*?&).",
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

/* ---- Types ---- */

type Tab = "email" | "phone";

interface RequestResetFormProps {
  onSuccess: (email: string) => void;
}

/* ---- Component ---- */

export default function RequestResetForm({ onSuccess }: RequestResetFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("email");
  const [phoneStep, setPhoneStep] = useState<"input" | "otp">("input");
  const [pendingPhone, setPendingPhone] = useState("");

  /* ---- Mutations ---- */

  const emailForgotMut = useMutation(forgotPassword);
  const phoneForgotMut = useMutation(forgotPasswordPhone);
  const phoneResetMut = useMutation(resetPasswordPhone);

  /* ---- Email form ---- */

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  function onEmailSubmit(values: z.infer<typeof emailSchema>) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    emailForgotMut.mutate(
      { email: values.email, redirectTo: `${origin}/reset-password` },
      {
        onSuccess: () => {
          onSuccess(values.email);
        },
      },
    );
  }

  /* ---- Phone form ---- */

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  function onPhoneSubmit(values: z.infer<typeof phoneSchema>) {
    const normalized = normalizeNgPhone(values.phone) ?? values.phone;
    phoneForgotMut.mutate(
      { phoneNumber: normalized },
      {
        onSuccess: () => {
          setPendingPhone(normalized);
          setPhoneStep("otp");
          toast.success("Verification code sent to your phone");
        },
      },
    );
  }

  /* ---- Phone OTP + reset form ---- */

  const phoneResetForm = useForm<z.infer<typeof phoneResetSchema>>({
    resolver: zodResolver(phoneResetSchema),
    defaultValues: { otp: "", newPassword: "", confirmPassword: "" },
  });

  function onPhoneResetSubmit(values: z.infer<typeof phoneResetSchema>) {
    phoneResetMut.mutate(
      {
        phoneNumber: pendingPhone,
        otp: values.otp,
        newPassword: values.newPassword,
      },
      {
        onSuccess: () => {
          toast.success("Password reset successfully");
          router.push("/login");
        },
      },
    );
  }

  /* ---- Tab button helper ---- */

  function tabBtn(tab: Tab, label: string) {
    return (
      <Button
        key={tab}
        variant="ghost"
        size="sm"
        onClick={() => setActiveTab(tab)}
        className={`h-9 rounded-sm ${
          activeTab === tab
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
      </Button>
    );
  }

  /* ---- Render: phone OTP step ---- */

  if (phoneStep === "otp") {
    return (
      <div className="w-full space-y-5">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase text-primary">
            Account recovery
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">
            Reset password
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Enter the code sent to{" "}
            <span className="font-medium text-foreground">
              {pendingPhone}
            </span>{" "}
            and set a new password.
          </p>
        </div>

        {phoneResetMut.isError && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">
              {getError(
                phoneResetMut.error,
                "Failed to reset password. Please try again.",
              )}
            </AlertDescription>
          </Alert>
        )}

        <Form {...phoneResetForm}>
          <form
            onSubmit={phoneResetForm.handleSubmit(onPhoneResetSubmit)}
            className="space-y-3.5"
          >
            <FormField
              control={phoneResetForm.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Verification code
                  </FormLabel>
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

            <FormField
              control={phoneResetForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    New password
                  </FormLabel>
                  <FormControl>
                    <InputPassword
                      placeholder="Enter your new password"
                      className="h-11"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={phoneResetForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Confirm password
                  </FormLabel>
                  <FormControl>
                    <InputPassword
                      placeholder="Confirm your new password"
                      className="h-11"
                      showStrength={false}
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
              loading={phoneResetMut.isPending}
              disabled={phoneResetMut.isPending}
            >
              Reset password
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              Want to use a different number?{" "}
              <button
                type="button"
                onClick={() => {
                  setPhoneStep("input");
                  setPendingPhone("");
                }}
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

  /* ---- Render: input step ---- */

  return (
    <div className="w-full space-y-5">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase text-primary">
          Account recovery
        </p>
        <h1 className="text-2xl font-semibold tracking-normal">
          Forgot password
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Enter your email or phone number and we&apos;ll send reset
          instructions.
        </p>
      </div>

      {/* Tabs */}
      {PHONE_AUTH_ENABLED && (
        <div className="grid grid-cols-2 rounded-md border bg-muted p-1">
          {tabBtn("email", "Email")}
          {tabBtn("phone", "Phone")}
        </div>
      )}

      {/* Email tab */}
      {activeTab === "email" && (
        <>
          {emailForgotMut.isError && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">
                {getError(
                  emailForgotMut.error,
                  "Failed to request password reset. Please try again.",
                )}
              </AlertDescription>
            </Alert>
          )}

          <Form {...emailForm}>
            <form
              onSubmit={emailForm.handleSubmit(onEmailSubmit)}
              className="space-y-4"
            >
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="name@company.com"
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
                loading={emailForgotMut.isPending}
                disabled={emailForgotMut.isPending}
              >
                Send reset instructions
              </Button>
            </form>
          </Form>
        </>
      )}

      {/* Phone tab */}
      {activeTab === "phone" && (
        <>
          {phoneForgotMut.isError && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">
                {getError(
                  phoneForgotMut.error,
                  "Failed to request password reset. Please try again.",
                )}
              </AlertDescription>
            </Alert>
          )}

          <Form {...phoneForm}>
            <form
              onSubmit={phoneForm.handleSubmit(onPhoneSubmit)}
              className="space-y-4"
            >
              <FormField
                control={phoneForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Phone Number
                    </FormLabel>
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

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={phoneForgotMut.isPending}
                disabled={phoneForgotMut.isPending}
              >
                Send reset code
              </Button>
            </form>
          </Form>
        </>
      )}

      <div className="text-center text-xs text-muted-foreground">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary hover:underline"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
