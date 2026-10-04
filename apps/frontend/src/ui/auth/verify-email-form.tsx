"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon, icons } from "@/components/icon";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { verifyEmail, resendVerification } from "@/lib/mutations/user/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import getErrorMessage from "./utils";

export default function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const router = useRouter();

  const [otp, setOtp] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  const verifyMut = useMutation(verifyEmail);
  const resendMut = useMutation(resendVerification);

  // If no email in search params, redirect to signup
  useEffect(() => {
    if (!email) {
      router.push("/sign-up");
    }
  }, [email, router]);

  if (!email) return null;

  function handleVerify() {
    if (otp.length !== 6) return;
    verifyMut.mutate(
      { email, otp },
      {
        onSuccess: () => {
          toast.success("Email verified successfully");
          setIsVerified(true);
        },
      },
    );
  }

  function handleResend() {
    resendMut.mutate(
      { email },
      { onSuccess: () => toast.success("Code resent") },
    );
  }

  if (isVerified) {
    return (
      <div className="mx-auto w-full max-w-md space-y-6 text-center">
        <div className="space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
            <Icon icon={icons.checkCircle} size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-normal">
              Email verified
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Your email has been verified. You can now sign in.
            </p>
          </div>
        </div>
        <Button
          onClick={() => router.push("/login")}
          size="lg"
          className="w-full"
        >
          Continue to login
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 text-center">
      <div className="space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
          <Icon icon={icons.mail} size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-normal">
            Verify your email
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </p>
        </div>
      </div>

      {(verifyMut.isError || resendMut.isError) && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">
            {verifyMut.isError &&
              getErrorMessage(verifyMut.error, "Verification failed. Please try again.")}
            {resendMut.isError &&
              getErrorMessage(resendMut.error, "Failed to resend code. Please try again.")}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <Input
          placeholder="000000"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          maxLength={6}
          autoComplete="one-time-code"
          className="h-11 text-center text-lg tracking-widest"
        />

        <Button
          onClick={handleVerify}
          size="lg"
          className="w-full"
          loading={verifyMut.isPending}
          disabled={otp.length !== 6 || verifyMut.isPending}
        >
          Verify email
        </Button>

        <div className="text-center">
          <span className="text-xs text-muted-foreground">
            Didn&apos;t receive the code?{" "}
          </span>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs font-semibold text-primary"
            onClick={handleResend}
            disabled={resendMut.isPending}
            loading={resendMut.isPending}
          >
            Resend code
          </Button>
        </div>
      </div>
    </div>
  );
}
