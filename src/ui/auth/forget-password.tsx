"use client";

import type React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Step 1: Email submission schema
const emailSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

// Step 2: Verification code schema
const verificationSchema = z.object({
  code: z.string().length(5, {
    message: "Verification code must be 5 digits.",
  }),
});

// Step 3: Password reset schema
const passwordResetSchema = z
  .object({
    password: z.string().min(8, {
      message: "Password must be at least 8 characters.",
    }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type EmailFormData = z.infer<typeof emailSchema>;
type VerificationFormData = z.infer<typeof verificationSchema>;
type PasswordResetFormData = z.infer<typeof passwordResetSchema>;

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<"email" | "verification" | "reset">("email");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Email form
  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  // Verification form
  const verificationForm = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { code: "" },
  });

  // Password reset form
  const passwordForm = useForm<PasswordResetFormData>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onEmailSubmit = async (data: EmailFormData) => {
    console.log("Sending reset email to:", data.email);
    setEmail(data.email);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setStep("verification");
  };

  const onVerificationSubmit = async (data: VerificationFormData) => {
    console.log("Verifying code:", data.code);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setStep("reset");
  };

  const onPasswordResetSubmit = async (data: PasswordResetFormData) => {
    console.log("Resetting password");
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Redirect to login or show success message
    alert("Password reset successfully!");
  };

  const handleResendCode = async () => {
    setIsResending(true);
    console.log("Resending verification code to:", email);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsResending(false);
  };

  // Step 1: Email submission
  if (step === "email") {
    return (
      <div className="w-full  mx-auto space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Forgot Password</h1>
          <p className="text-muted-foreground">
            Enter your email address and we'll send you a verification code to
            reset your password.
          </p>
        </div>

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
                      placeholder="Enter your email address"
                      className="h-12"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-12 bg-gray-200 hover:bg-gray-300 text-gray-700"
            >
              Send Verification Code
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <Link
                href="/login"
                className="text-green-600 hover:underline font-medium"
              >
                Back to Login
              </Link>
            </div>
          </form>
        </Form>
      </div>
    );
  }

  // Step 2: Verification code
  if (step === "verification") {
    return (
      <div className="w-full  mx-auto space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Forgot Password</h1>
          <p className="text-muted-foreground">
            A 5-Digit verification code has been sent to your email address.
            Enter the code to verify your account.
          </p>
        </div>

        <Form {...verificationForm}>
          <form
            onSubmit={verificationForm.handleSubmit(onVerificationSubmit)}
            className="space-y-4"
          >
            <FormField
              control={verificationForm.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Enter Verification Code
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2 justify-center">
                      <VerificationCodeInput
                        value={field.value}
                        onChange={field.onChange}
                      />
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
                disabled={isResending}
                className="text-sm text-green-600 hover:underline font-medium"
              >
                {isResending ? "Resending..." : "Resend"}
              </button>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-gray-200 hover:bg-gray-300 text-gray-700"
            >
              Continue
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              By clicking "Continue", you agree to MicroBuilt's{" "}
              <Link href="/terms" className="text-green-600 hover:underline">
                Terms of Use
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-green-600 hover:underline">
                Privacy Policy
              </Link>
            </div>
          </form>
        </Form>
      </div>
    );
  }

  // Step 3: Password reset
  return (
    <div className="w-full  mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Forgot Password</h1>
        <p className="text-muted-foreground">
          Enter and confirm your new password below
        </p>
      </div>

      <Form {...passwordForm}>
        <form
          onSubmit={passwordForm.handleSubmit(onPasswordResetSubmit)}
          className="space-y-4"
        >
          <FormField
            control={passwordForm.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  Enter Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your new password"
                      className="h-12 pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground/60"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={passwordForm.control}
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
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full h-12 bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            Confirm
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
        </form>
      </Form>
    </div>
  );
}

// Verification Code Input Component
function VerificationCodeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const handleInputChange = (index: number, inputValue: string) => {
    if (inputValue.length > 1) return; // Prevent multiple characters

    const newValue = value.split("");
    newValue[index] = inputValue;
    const result = newValue.join("").slice(0, 5); // Ensure max 5 characters
    onChange(result);

    // Auto-focus next input
    if (inputValue && index < 4) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <div className="flex gap-2">
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="relative">
          <Input
            id={`code-${index}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            className="w-12 h-12 text-center text-lg font-semibold"
            value={value[index] || ""}
            onChange={(e) => handleInputChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
          />
          {value[index] && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
