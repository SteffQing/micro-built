"use client";

import { useState, type ReactNode } from "react";
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
import { cn } from "@/lib/utils";
import { errorMessage } from "./errors";

const MIN_REASON = 5;

/**
 * A super-admin action that needs a reason (no payroll, reverts). Asks why; then the shared "Confirm it's you" prompt
 * takes the authenticator code or a passkey before the API does it. Opened by `trigger`, or controlled with
 * `open`/`onOpenChange`.
 */
export function ReasonDialog({
  title,
  points,
  label,
  placeholder,
  confirmLabel,
  pendingLabel,
  destructive = true,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onConfirm,
}: {
  title: string;
  /** What will happen, as short lines. */
  points: ReactNode[];
  label: string;
  placeholder: string;
  confirmLabel: string;
  pendingLabel: string;
  destructive?: boolean;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Resolves when done; a rejection is shown in the dialog. */
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function setOpen(next: boolean) {
    if (pending) return;
    if (controlledOpen === undefined) setOwnOpen(next);
    onOpenChange?.(next);
    if (!next) {
      setReason("");
      setError("");
    }
  }

  async function confirm() {
    setError("");
    setPending(true);
    try {
      await onConfirm(reason.trim());
      setPending(false);
      setOpen(false);
    } catch (failure) {
      setPending(false);
      setError(errorMessage(failure));
    }
  }

  const ready = reason.trim().length >= MIN_REASON;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="grid-cols-1 gap-0 sm:max-w-md">
        <DialogHeader className="border-b">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-xl",
                destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
              )}
            >
              <Icon icon={icons.shieldAlert} size={20} />
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>You&apos;ll confirm it with your authenticator code or a passkey.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          className={cn(dialogBodyClass, "pt-4")}
          onSubmit={(e) => {
            e.preventDefault();
            if (ready && !pending) void confirm();
          }}
        >
          <ul className="grid gap-1.5 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
            {points.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
          <div className="grid gap-1.5">
            <Label htmlFor="action-reason">{label}</Label>
            <Textarea
              id="action-reason"
              autoFocus
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={placeholder}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">Kept in the audit log.</p>
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
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={!ready || pending}>
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
