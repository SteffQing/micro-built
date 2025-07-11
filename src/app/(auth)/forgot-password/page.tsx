"use client";

import RequestResetForm from "@/ui/auth/forgot-password/request-reset-form";
import ResetPasswordForm from "@/ui/auth/forgot-password/reset-password-form";
import { useState } from "react";

export default function ForgotPasswordFlow() {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [userEmail, setUserEmail] = useState("");

  const handleRequestSuccess = (email: string) => {
    setUserEmail(email);
    setStep("reset");
  };

  if (step === "reset") {
    return (
      <>
        <div className="w-full h-full flex items-center justify-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Forgot Password</h1>
            <p className="text-muted-foreground">
              Further instructions has been sent to your email{" "}
              <span className="text-primary">{userEmail}</span>
            </p>
          </div>
        </div>
      </>
    );
  }

  return <RequestResetForm onSuccess={handleRequestSuccess} />;
}
