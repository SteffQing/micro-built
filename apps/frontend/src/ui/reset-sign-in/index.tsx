"use client";

import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resetSignIn } from "@/lib/mutations/admin/superadmin";
import { cn } from "@/lib/utils";

const MIN_REASON = 5;

/**
 * For someone locked out (lost phone, authenticator or security key): their 2FA and passkeys are removed and they are
 * signed out everywhere. Super admins only, never on themselves; asks why (audit log), then the code or passkey.
 */
export function ResetSignInForm({ id, name, onDone }: { id: string; name: string; onDone?: () => void }) {
  const [reason, setReason] = useState("");
  const reset = useMutation(resetSignIn);
  const ready = reason.trim().length >= MIN_REASON;

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || reset.isPending) return;
        reset.mutate(
          { id, reason: reason.trim() },
          {
            onSuccess: () => {
              setReason("");
              onDone?.();
            },
          },
        );
      }}
    >
      <ul className="grid gap-1.5 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
        <li>Their two-factor authentication and passkeys are removed.</li>
        <li>They are signed out on every device and told by email or SMS.</li>
        <li>Check it is really them first: a call, or in person.</li>
      </ul>
      <div className="grid gap-1.5">
        <Label htmlFor={`reset-reason-${id}`}>Why are you resetting {name}&apos;s sign-in?</Label>
        <Textarea
          id={`reset-reason-${id}`}
          rows={3}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Lost the phone with the authenticator app; confirmed on a call"
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">Kept in the audit log.</p>
      </div>
      <Button type="submit" variant="destructive" disabled={!ready} loading={reset.isPending} className="justify-self-end">
        <Icon icon={icons.refresh} size={14} />
        Reset sign-in
      </Button>
    </form>
  );
}

/** The reset in its own dialog (the customer page); Admin management has it inside the Manage dialog. */
export function ResetSignInDialog({ id, name, trigger }: { id: string; name: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="grid-cols-1 gap-0 sm:max-w-md">
        <DialogHeader className="border-b">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <Icon icon={icons.shieldAlert} size={20} />
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle>Reset {name}&apos;s sign-in</DialogTitle>
              <DialogDescription>For someone locked out of their account.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className={cn(dialogBodyClass, "pt-4")}>
          <ResetSignInForm id={id} name={name} onDone={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
