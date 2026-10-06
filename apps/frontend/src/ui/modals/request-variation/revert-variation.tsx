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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { revertVariationSchedule } from "@/lib/mutations/admin/repayments";
import { cn } from "@/lib/utils";

const MIN_REASON = 5;

/**
 * Undoes a generated month. Asks why; then the shared "Confirm it's you" prompt takes the authenticator code or a
 * passkey before the API does it.
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
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const reversal = useMutation(revertVariationSchedule);

  function reset() {
    setReason("");
    setError("");
  }

  async function revert() {
    setError("");
    try {
      await reversal.mutateAsync({ period: month, reason: reason.trim() });
      setOpen(false);
      reset();
    } catch (failure) {
      setError(errorMessage(failure));
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
              <DialogDescription>You&apos;ll confirm it with your authenticator code or a passkey.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          className={cn(dialogBodyClass, "pt-4")}
          onSubmit={(e) => {
            e.preventDefault();
            if (reasonReady && !reversal.isPending) void revert();
          }}
        >
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

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter className="border-t pt-4">
            <Button type="submit" variant="destructive" disabled={!reasonReady || reversal.isPending}>
              {reversal.isPending ? "Reverting…" : "Revert variation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
