"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import RequestResetForm from "@/ui/auth/forgot-password/request-reset-form";
import ResetPasswordForm from "@/ui/auth/forgot-password/reset-password-form";

export default function ForgotPasswordFlow() {
  const [step, setStep] = useState<"request" | "success">("request");
  const [userEmail, setUserEmail] = useState("");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (token) {
    return <ResetPasswordForm />;
  }

  const handleRequestSuccess = (email: string) => {
    setUserEmail(email);
    setStep("success");
  };

  if (step === "success") {
    return (
      <div className="w-full max-w-md mx-auto space-y-6 p-6 text-center">
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Check Your Email</h1>
            <p className="text-muted-foreground">
              We've sent password reset instructions to{" "}
              <span className="font-medium text-foreground">{userEmail}</span>.
              Please check your email and follow the link to reset your
              password.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Didn't receive the email? Check your spam folder or try requesting
            another reset.
          </p>

          <button
            onClick={() => setStep("request")}
            className="text-sm text-green-600 hover:underline font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return <RequestResetForm onSuccess={handleRequestSuccess} />;
}
