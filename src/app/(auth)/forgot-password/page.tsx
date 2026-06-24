"use client";

import RequestResetForm from "@/ui/auth/forgot-password/request-reset-form";
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
      <div className="w-full space-y-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
          <span className="text-xs font-semibold">OK</span>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-primary">
            Check your email
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">
            Reset instructions sent
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Further instructions have been sent to{" "}
            <span className="font-medium text-foreground">{userEmail}</span>.
          </p>
        </div>
      </div>
    );
  }

  return <RequestResetForm onSuccess={handleRequestSuccess} />;
}
