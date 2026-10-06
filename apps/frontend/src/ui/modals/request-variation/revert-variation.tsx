"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { revertVariationSchedule } from "@/lib/mutations/admin/repayments";
import { cn } from "@/lib/utils";

const MIN_REASON = 5;

/**
 * Undoes a generated month: the reason first, then the authenticator code. The code auto-submits on the sixth digit;
 * a wrong one clears the boxes so the next can be typed straight in.
 */
export function RevertVariation({
  month,
  label,
  errorMessage,
}: {
  month: string;
  label: string;
  errorMessage: (error: unknown) => string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"reason" | "code">("reason");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const reversal = useMutation(revertVariationSchedule);

  function reset() {
    setStep("reason");
    setReason("");
    setCode("");
    setError("");
  }

  async function revert(otp: string) {
    setError("");
    try {
      await reversal.mutateAsync({ period: month, reason: reason.trim(), code: otp });
      setOpen(false);
      reset();
    } catch (failure) {
      setError(errorMessage(failure));
      setCode("");
    }
  }

  const reasonReady = reason.trim().length >= MIN_REASON;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (reversal.isPending) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Icon icon={icons.refresh} size={14} />
          Revert
        </Button>
      </DialogTrigger>
      <DialogContent className="grid-cols-1 gap-0 sm:max-w-md">
        <DialogHeader className="border-b">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <Icon icon={icons.shieldAlert} size={20} />
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle>Revert {label}</DialogTitle>
              <DialogDescription>
                Step {step === "reason" ? 1 : 2} of 2 · {step === "reason" ? "Reason" : "Confirm with 2FA"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          className={cn(dialogBodyClass, "pt-4")}
          onSubmit={(e) => {
            e.preventDefault();
            if (step === "reason" && reasonReady) setStep("code");
            else if (step === "code" && code.length === 6) void revert(code);
          }}
        >
          {step === "reason" ? (
            <>
              <ul className="grid gap-1.5 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
                <li>The month goes back to not generated and its deductions reopen.</li>
                <li>Next month&apos;s deductions are removed and the file is deleted.</li>
                <li>Every super admin is notified. Only revert if the file never reached payroll.</li>
              </ul>
              <div className="grid gap-1.5">
                <Label htmlFor="revert-reason">Why are you reverting it?</Label>
                <Textarea
                  id="revert-reason"
                  autoFocus
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Generated instead of requesting a draft"
                  maxLength={300}
                />
                <p className="text-xs text-muted-foreground">Shown to every super admin.</p>
              </div>
            </>
          ) : (
            <div className="grid justify-items-center gap-3 py-2 text-center">
              <Label htmlFor="revert-code">Enter the 6-digit code from your authenticator app</Label>
              <InputOTP
                id="revert-code"
                autoFocus
                maxLength={6}
                inputMode="numeric"
                pattern="^[0-9]*$"
                autoComplete="one-time-code"
                value={code}
                onChange={(v) => setCode(v.replace(/\D/g, ""))}
                onComplete={(v: string) => void revert(v)}
                disabled={reversal.isPending}
              >
                <InputOTPGroup className="gap-2">
                  {Array.from({ length: 6 }, (_, i) => (
                    <InputOTPSlot key={i} index={i} className="size-11 rounded-md border bg-card text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <p className="max-w-full truncate text-xs text-muted-foreground">Reason: {reason.trim()}</p>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter className="border-t pt-4">
            {step === "code" && (
              <Button
                type="button"
                variant="outline"
                disabled={reversal.isPending}
                onClick={() => {
                  setStep("reason");
                  setCode("");
                  setError("");
                }}
              >
                Back
              </Button>
            )}
            {step === "reason" ? (
              <Button type="submit" variant="destructive" disabled={!reasonReady}>
                Continue
              </Button>
            ) : (
              <Button type="submit" variant="destructive" disabled={reversal.isPending || code.length !== 6}>
                {reversal.isPending ? "Reverting…" : "Revert variation"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
