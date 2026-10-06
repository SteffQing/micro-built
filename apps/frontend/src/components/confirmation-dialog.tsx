"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/axios";
import { onConfirmationPrompt, type ConfirmationPrompt } from "@/lib/confirmation";
import { cn } from "@/lib/utils";

type Grant = ApiRes<{ token: string; expiresAt: string }>;

function messageOf(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string") return message;
  }
  // The browser's own passkey errors (cancelled, timed out) are not worth showing word for word.
  if (error instanceof Error && error.name === "NotAllowedError") return "The passkey prompt was closed. Try again.";
  return fallback;
}

/**
 * The one "Confirm it's you" prompt for gated actions (see lib/confirmation.ts): the authenticator code, which submits
 * on the sixth digit, or a passkey. Mounted once in RootProvider.
 */
export function ConfirmationDialog() {
  const [prompt, setPrompt] = useState<ConfirmationPrompt | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"code" | "passkey" | null>(null);
  const settled = useRef(false);

  useEffect(
    () =>
      onConfirmationPrompt((next) => {
        settled.current = false;
        setCode("");
        setError("");
        setBusy(null);
        setPrompt(next);
      }),
    [],
  );

  function finish(token: string | null) {
    if (!prompt || settled.current) return;
    settled.current = true;
    prompt.resolve(token);
    setPrompt(null);
  }

  async function withCode(otp: string) {
    setBusy("code");
    setError("");
    try {
      const res = await api.post<Grant>("/confirmations/code", { code: otp });
      finish(res.data.data?.token ?? null);
    } catch (failure) {
      setError(messageOf(failure, "That code could not be checked. Try again."));
      setCode("");
    } finally {
      setBusy(null);
    }
  }

  async function withPasskey() {
    setBusy("passkey");
    setError("");
    try {
      const start = await api.post<ApiRes<{ id: string; options: PublicKeyCredentialRequestOptionsJSON }>>(
        "/confirmations/passkey/options",
      );
      if (!start.data.data) throw new Error("No passkey prompt");
      const { id, options } = start.data.data;
      const response = await startAuthentication({ optionsJSON: options });
      const res = await api.post<Grant>("/confirmations/passkey", { id, response });
      finish(res.data.data?.token ?? null);
    } catch (failure) {
      setError(messageOf(failure, "Your passkey could not be verified. Try again."));
    } finally {
      setBusy(null);
    }
  }

  const methods = prompt?.methods;
  const none = !!methods && !methods.totp && !methods.passkey;

  return (
    <Dialog open={!!prompt} onOpenChange={(next) => !next && !busy && finish(null)}>
      <DialogContent className="grid-cols-1 gap-0 sm:max-w-sm">
        <DialogHeader className="border-b">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon icon={icons.shield} size={20} />
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle>{none ? "Set up 2FA or a passkey" : "Confirm it's you"}</DialogTitle>
              <DialogDescription>
                {none
                  ? "This action needs your authenticator code or a passkey, and you have neither yet."
                  : prompt?.mode === "window"
                    ? "Then you won't be asked again on this device for 10 minutes."
                    : "This action needs a fresh confirmation."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className={cn(dialogBodyClass, "gap-4 pt-4")}>
          {none ? (
            <Button asChild className="w-full" onClick={() => finish(null)}>
              <Link href="/settings?view=authentication">
                Go to 2FA &amp; Passkeys
                <Icon icon={icons.chevronRight} size={14} />
              </Link>
            </Button>
          ) : (
            <>
              {methods?.passkey && (
                <Button
                  type="button"
                  className="w-full"
                  autoFocus
                  onClick={() => void withPasskey()}
                  loading={busy === "passkey"}
                  disabled={!!busy}
                >
                  <Icon icon={icons.lock} size={16} />
                  Use your passkey
                </Button>
              )}

              {methods?.passkey && methods.totp && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}

              {methods?.totp && (
                <div className="grid justify-items-center gap-3 text-center">
                  <Label htmlFor="confirm-code">Code from your authenticator app</Label>
                  <InputOTP
                    id="confirm-code"
                    autoFocus={!methods.passkey}
                    maxLength={6}
                    inputMode="numeric"
                    pattern="^[0-9]*$"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(v) => setCode(v.replace(/\D/g, ""))}
                    onComplete={(v: string) => void withCode(v)}
                    disabled={!!busy}
                  >
                    <InputOTPGroup className="gap-2">
                      {Array.from({ length: 6 }, (_, i) => (
                        <InputOTPSlot key={i} index={i} className="size-11 rounded-md border bg-card text-lg" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              )}
            </>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
