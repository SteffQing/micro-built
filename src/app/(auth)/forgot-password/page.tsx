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

  const handleGoBack = () => {
    setStep("request");
  };

  if (step === "reset") {
    return <ResetPasswordForm email={userEmail} onGoBack={handleGoBack} />;
  }

  return <RequestResetForm onSuccess={handleRequestSuccess} />;
}
