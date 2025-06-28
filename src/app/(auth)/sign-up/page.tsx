"use client";

import SignupForm from "@/ui/auth/sign-up/sign-up-form";
import VerifyOtpForm from "@/ui/auth/sign-up/verify-otp-form";
import { useState } from "react";
// import SignupForm from "@ui/auth/sign-up/sign-up-form";
// import VerifyOtpForm from "@ui/auth/sign-up/verify-otp-form";

export default function SignUpFlow() {
  const [step, setStep] = useState<"signup" | "verification">("signup");
  const [userEmail, setUserEmail] = useState("");

  const handleSignupSuccess = (email: string) => {
    setUserEmail(email);
    setStep("verification");
  };

  const handleGoBack = () => {
    setStep("signup");
  };

  if (step === "verification") {
    return <VerifyOtpForm email={userEmail} onGoBack={handleGoBack} />;
  }

  return <SignupForm onSuccess={handleSignupSuccess} />;
}
