"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { AxiosError } from "axios";

const resetPasswordSchema = z
  .object({
    token: z.string().length(5, {
      message: "Verification code must be exactly 5 digits.",
    }),
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
      .regex(/\d/, { message: "Password must contain at least one number." })
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

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  {
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
  },
  {
    label: "Maximum 50 characters",
    test: (password) => password.length <= 50,
  },
  {
    label: "One uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    label: "One lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    label: "One number",
    test: (password) => /\d/.test(password),
  },
  {
    label: "One special character (@$!%*?&)",
    test: (password) => /[@$!%*?&]/.test(password),
  },
];

interface ResetPasswordFormProps {
  email: string;
  onGoBack: () => void;
}

export default function ResetPasswordForm({
  email,
  onGoBack,
}: ResetPasswordFormProps) {
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { newPassword: string; token: string }) => {
      const response = await api.post("/auth/reset-password", data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Password reset successful!");
      router.push("/login");
    },
    onError: (error: unknown) => {
      let errorMessage = "Failed to reset password. Please try again.";

      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as AxiosError<{ message?: string | string[] }>;

        // Extract error message from response
        if (axiosError.response?.data?.message) {
          errorMessage = Array.isArray(axiosError.response.data.message)
            ? axiosError.response.data.message.join(", ")
            : axiosError.response.data.message || errorMessage;
        }

        // Handle specific error cases
        switch (axiosError.response?.status) {
          case 400:
            errorMessage =
              "Please check your verification code and password requirements.";
            break;
          case 401:
            errorMessage =
              "Invalid or expired verification code. Please request a new one.";
            break;
          case 404:
            errorMessage = "Email not found. Please check your email address.";
            break;
          default:
            break;
        }
      }
      toast.error(errorMessage);
    },
  });

  // Resend code mutation
  const resendMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post("/auth/forgot-password", { email });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Verification code sent successfully!");
    },
    onError: (error: any) => {
      let errorMessage = "Failed to resend code. Please try again.";

      if (error.response?.status === 404) {
        errorMessage = "Email not found. Please check your email address.";
      } else if (error.response?.data?.message) {
        errorMessage = Array.isArray(error.response.data.message)
          ? error.response.data.message.join(", ")
          : error.response.data.message;
      }

      toast.error(errorMessage);
    },
  });

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const token = form.watch("token");
  const newPassword = form.watch("newPassword");
  const confirmPassword = form.watch("confirmPassword");

  // Check password requirements in real-time
  const passwordChecks = useMemo(() => {
    return passwordRequirements.map((req) => ({
      ...req,
      passed: req.test(newPassword || ""),
    }));
  }, [newPassword]);

  // Check if all password requirements are met
  const allPasswordRequirementsMet = passwordChecks.every(
    (check) => check.passed
  );
  const passwordsMatch =
    newPassword === confirmPassword && confirmPassword.length > 0;
  const isTokenValid = token.length === 5 && /^\d{5}$/.test(token);

  // Check if form is valid for submission
  const isFormValid =
    isTokenValid && allPasswordRequirementsMet && passwordsMatch;

  function onSubmit(values: z.infer<typeof resetPasswordSchema>) {
    if (!isFormValid) return;

    resetPasswordMutation.mutate({
      newPassword: values.newPassword,
      token: values.token,
    });
  }

  function handleResendCode() {
    resendMutation.mutate(email);
  }

  return (
    <div className="w-full space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Forgot Password</h1>
        <p className="text-muted-foreground">
          A 5-digit verification code has been sent to your email address. Enter
          the code to verify your account.
        </p>
      </div>

      {(resetPasswordMutation.isError || resendMutation.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {resetPasswordMutation.isError && resetPasswordMutation.error && (
              resetPasswordMutation.error instanceof Error && 
              'response' in resetPasswordMutation.error &&
              resetPasswordMutation.error.response &&
              typeof resetPasswordMutation.error.response === 'object' &&
              'data' in resetPasswordMutation.error.response &&
              resetPasswordMutation.error.response.data &&
              typeof resetPasswordMutation.error.response.data === 'object' &&
              'message' in resetPasswordMutation.error.response.data
                ? Array.isArray(resetPasswordMutation.error.response.data.message)
                  ? resetPasswordMutation.error.response.data.message.join(", ")
                  : typeof resetPasswordMutation.error.response.data.message === 'string'
                    ? resetPasswordMutation.error.response.data.message
                    : "Failed to reset password. Please try again."
                : "Failed to reset password. Please try again."
            )}
            {resendMutation.isError && resendMutation.error && (
              resendMutation.error instanceof Error && 
              'response' in resendMutation.error &&
              resendMutation.error.response &&
              typeof resendMutation.error.response === 'object' &&
              'data' in resendMutation.error.response &&
              resendMutation.error.response.data &&
              typeof resendMutation.error.response.data === 'object' &&
              'message' in resendMutation.error.response.data
                ? Array.isArray(resendMutation.error.response.data.message)
                  ? resendMutation.error.response.data.message.join(", ")
                  : typeof resendMutation.error.response.data.message === 'string'
                    ? resendMutation.error.response.data.message
                    : "Failed to resend code. Please try again."
                : "Failed to resend code. Please try again."
            )}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="token"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  Enter Verification Code
                </FormLabel>
                <FormControl>
                  <div className="flex justify-center">
                    <InputOTP maxLength={5} {...field}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="text-center">
            <span className="text-sm text-muted-foreground">
              Didn't Receive Verification Code?{" "}
            </span>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendMutation.isPending}
              className="text-sm text-green-600 hover:underline font-medium disabled:opacity-50"
            >
              {resendMutation.isPending ? "Resending..." : "Resend"}
            </button>
          </div>

          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  Enter Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter your new password"
                      className="h-12 pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground/60"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>

                {/* Password Requirements */}
                {newPassword && (
                  <div className="mt-2 space-y-2">
                    {passwordChecks.map((check, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-2 text-sm"
                      >
                        {check.passed ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                        <span
                          className={
                            check.passed ? "text-green-600" : "text-red-600"
                          }
                        >
                          {check.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  Confirm Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your new password"
                      className="h-12 pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground/60"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>

                {/* Password Match Indicator */}
                {confirmPassword && (
                  <div className="flex items-center space-x-2 text-sm mt-2">
                    {passwordsMatch ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                    <span
                      className={
                        passwordsMatch ? "text-green-600" : "text-red-600"
                      }
                    >
                      {passwordsMatch
                        ? "Passwords match"
                        : "Passwords dont match"}
                    </span>
                  </div>
                )}

                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isFormValid || resetPasswordMutation.isPending}
          >
            {resetPasswordMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              "Confirm"
            )}
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            By clicking "Confirm", you agree to MicroBuilt's{" "}
            <Link href="/terms" className="text-green-600 hover:underline">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-green-600 hover:underline">
              Privacy Policy
            </Link>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Want to use a different email?{" "}
            <button
              type="button"
              onClick={onGoBack}
              className="text-green-600 hover:underline font-medium"
            >
              Go Back
            </button>
          </div>
        </form>
      </Form>
    </div>
  );
}
