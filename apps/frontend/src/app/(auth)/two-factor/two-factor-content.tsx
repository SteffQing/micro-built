"use client";

import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useMutation } from "@tanstack/react-query";
import { verifyTwoFactorTotp, sendTwoFactorOtp, verifyTwoFactorOtp, verifyTwoFactorBackup } from "@/lib/mutations/user/auth";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Method = "totp" | "otp" | "backup";

const COPY: Record<Method, { title: string; hint: string }> = {
  totp: { title: "Enter your 6-digit code", hint: "Open your authenticator app and enter the current code." },
  // The code goes to the account's email; only an account without one gets it by text.
  otp: {
    title: "Check your email",
    hint: "Enter the 6-digit code we emailed you. No email on your account? It came by text message instead.",
  },
  backup: { title: "Use a backup code", hint: "Enter one of the recovery codes you saved. Each code works once." },
};

export default function TwoFactorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const [method, setMethod] = useState<Method>("totp");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const verifyTotp = useMutation(verifyTwoFactorTotp);
  const sendOtp = useMutation(sendTwoFactorOtp);
  const verifyOtp = useMutation(verifyTwoFactorOtp);
  const verifyBackup = useMutation(verifyTwoFactorBackup);

  const verifier = method === "totp" ? verifyTotp : method === "otp" ? verifyOtp : verifyBackup;
  const isBackup = method === "backup";
  const needsSend = method === "otp" && !otpSent;
  const ready = isBackup ? code.trim().length > 0 : code.length === 6;

  const switchTo = (m: Method) => {
    setMethod(m);
    setCode("");
  };

  const submit = (value = code) => {
    // Guards the auto-submit on the 6th digit against a second submit from Enter.
    if (verifier.isPending || needsSend) return;
    if (isBackup ? !value.trim() : value.length !== 6) return;
    verifier.mutate(
      { code: isBackup ? value.trim() : value },
      {
        onSuccess: () => {
          toast.success("Verification successful");
          router.push(next);
        },
        onError: () => setCode(""),
      },
    );
  };

  const send = () =>
    sendOtp.mutate(undefined, {
      onSuccess: () => {
        setOtpSent(true);
        toast.success("Code sent");
      },
    });

  const { title, hint } = COPY[method];

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-lg border bg-card p-5 text-card-foreground shadow-xs sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-muted">
            <Icon icon={icons.shield} size={24} className="text-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Two-factor authentication</h1>
          <p className="mt-1 text-sm text-muted-foreground">Verify it&apos;s you to finish signing in.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (needsSend) send();
            else submit();
          }}
          className="space-y-5"
        >
          <div className="space-y-1 text-center">
            <Label htmlFor="two-factor-code" className="justify-center text-base font-medium">
              {title}
            </Label>
            <p className="text-sm text-muted-foreground">{needsSend ? "We'll email you a one-time code (or text it, if your account has no email)." : hint}</p>
          </div>

          {needsSend ? null : isBackup ? (
            <Input
              id="two-factor-code"
              key="backup"
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Backup code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-11 text-center text-base"
            />
          ) : (
            <InputOTP
              id="two-factor-code"
              key={method}
              autoFocus
              maxLength={6}
              inputMode="numeric"
              pattern="^[0-9]*$"
              autoComplete="one-time-code"
              value={code}
              onChange={(v) => setCode(v.replace(/\D/g, ""))}
              onComplete={submit}
              disabled={verifier.isPending}
              containerClassName="w-full justify-center"
            >
              <InputOTPGroup className="w-full max-w-sm gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot key={i} index={i} className="h-12 max-w-14 flex-1 text-lg sm:h-14 sm:text-xl" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={needsSend ? sendOtp.isPending : !ready || verifier.isPending}
            loading={needsSend ? sendOtp.isPending : verifier.isPending}
          >
            {needsSend ? "Send code" : "Verify"}
          </Button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-1 border-t pt-4 text-sm">
          {method !== "totp" && (
            <Button type="button" variant="ghost" size="sm" onClick={() => switchTo("totp")}>
              Use authenticator app
            </Button>
          )}
          {method !== "otp" && (
            <Button type="button" variant="ghost" size="sm" onClick={() => switchTo("otp")}>
              Email me a code
            </Button>
          )}
          {method === "otp" && otpSent && (
            <Button type="button" variant="ghost" size="sm" onClick={send} disabled={sendOtp.isPending}>
              Resend code
            </Button>
          )}
          {!isBackup && (
            <Button type="button" variant="ghost" size="sm" onClick={() => switchTo("backup")}>
              Use a backup code
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
