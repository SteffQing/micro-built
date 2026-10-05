"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isPlaceholderEmail, visibleEmail } from "@microbuilt/shared";

import { authClient, emailOtp, phoneNumber } from "@/lib/auth-client";
import { getUser, userPendingChanges } from "@/lib/queries/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Icon, icons, type IconData } from "@/components/icon";
import { cn } from "@/lib/utils";

const CODE_LENGTH = 6;

/** A super admin's own changes apply at once; everyone else's wait for an admin (change requests). */
function useAfterChange(applied: boolean) {
  const queryClient = useQueryClient();
  return (what: string) => {
    if (applied) {
      toast.success(`${what} updated`);
      queryClient.invalidateQueries({ queryKey: getUser.queryKey });
    } else {
      toast.success(`${what} sent for approval. The current one stays in use until an admin approves it.`);
      queryClient.invalidateQueries({ queryKey: userPendingChanges.queryKey });
    }
  };
}

/** One profile field: label, value, and its edit control on the right. */
export function ProfileField({
  icon,
  label,
  value,
  action,
  children,
}: {
  icon: IconData;
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon icon={icon} size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {children ?? <p className="text-sm font-medium text-foreground wrap-anywhere">{value}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 sm:ml-4">{action}</div>}
    </div>
  );
}

/** The name, edited in place. */
export function NameField({ name, applied }: { name: string; applied: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const after = useAfterChange(applied);

  const save = useMutation({
    mutationFn: async (next: string) => {
      const res = await authClient.updateUser({ name: next });
      if (res.error) throw new Error(res.error.message ?? "Could not update your name");
    },
    onSuccess: () => {
      after("Name");
      setEditing(false);
    },
  });

  const trimmed = value.trim();
  if (!editing) {
    return (
      <ProfileField
        icon={icons.user}
        label="Name"
        value={name}
        action={
          <Button variant="outline" size="sm" onClick={() => { setValue(name); setEditing(true); }}>
            <Icon icon={icons.edit} size={14} /> Edit
          </Button>
        }
      />
    );
  }
  return (
    <ProfileField icon={icons.user} label="Name" value={null}>
      <form
        className="mt-1 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed.length < 2) return toast.error("Enter your full name");
          if (trimmed === name) return setEditing(false);
          save.mutate(trimmed);
        }}
      >
        <Input
          autoFocus
          aria-label="Name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-full sm:w-72"
          disabled={save.isPending}
        />
        <Button type="submit" size="sm" loading={save.isPending}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={save.isPending}>
          Cancel
        </Button>
      </form>
    </ProfileField>
  );
}

type Channel = "email" | "phone";

const COPY: Record<Channel, { title: string; noun: string; placeholder: string; type: string; icon: IconData }> = {
  email: { title: "Change email address", noun: "email address", placeholder: "name@example.com", type: "email", icon: icons.mail },
  phone: { title: "Change phone number", noun: "phone number", placeholder: "0803 123 4567", type: "tel", icon: icons.phone },
};

function Steps({ step }: { step: 1 | 2 }) {
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label={`Step ${step} of 2`}>
      {["New address", "Verify code"].map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const current = step === n;
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className={cn("h-px w-6", step > 1 ? "bg-primary" : "bg-border")} />}
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold",
                done || current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Icon icon={icons.check} size={12} /> : n}
            </span>
            <span className={current ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Email or phone change in two steps: the new address gets a code, the code confirms it. Both always need the
 * code (it proves the address is yours); what differs by role is only what happens after.
 */
export function ContactChangeDialog({
  channel,
  current,
  applied,
}: {
  channel: Channel;
  current: string | null;
  applied: boolean;
}) {
  const copy = COPY[channel];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const after = useAfterChange(applied);

  const reset = () => {
    setStep(1);
    setTarget("");
    setCode("");
  };

  const send = useMutation({
    mutationFn: async (address: string) => {
      const res =
        channel === "email"
          ? await emailOtp.requestEmailChange({ newEmail: address })
          : await phoneNumber.sendOtp({ phoneNumber: address });
      if (res.error) throw new Error(res.error.message ?? "Could not send the code");
    },
    onSuccess: () => {
      setStep(2);
      setCode("");
    },
  });

  const confirm = useMutation({
    mutationFn: async () => {
      const res =
        channel === "email"
          ? await emailOtp.changeEmail({ newEmail: target, otp: code })
          : await phoneNumber.verify({ phoneNumber: target, code, updatePhoneNumber: true } as Parameters<
              typeof phoneNumber.verify
            >[0]);
      if (res.error) throw new Error(res.error.message ?? "That code didn't work");
    },
    onSuccess: () => {
      after(channel === "email" ? "Email address" : "Phone number");
      setOpen(false);
      reset();
    },
  });

  const shown = channel === "email" ? (current && !isPlaceholderEmail(current) ? visibleEmail(current) : null) : current;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Icon icon={icons.edit} size={14} /> {shown ? "Change" : "Add"}
      </Button>
      <DialogContent className="grid-cols-1 gap-0 sm:max-w-md">
        <DialogHeader className="border-b">
          <DialogTitle className="flex items-center gap-2">
            <Icon icon={copy.icon} size={18} /> {copy.title}
          </DialogTitle>
          <DialogDescription>
            {applied
              ? `We'll send a code to the new ${copy.noun}; it takes effect as soon as you confirm it.`
              : `We'll send a code to the new ${copy.noun}. Once confirmed, an admin approves the change; your current one stays in use until then.`}
          </DialogDescription>
        </DialogHeader>

        <div className={cn(dialogBodyClass, "pt-4")}>
          <Steps step={step} />

          {step === 1 ? (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const address = target.trim();
                if (!address) return toast.error(`Enter the new ${copy.noun}`);
                send.mutate(address);
              }}
            >
              {shown && (
                <p className="text-sm text-muted-foreground">
                  Current: <span className="font-medium text-foreground wrap-anywhere">{shown}</span>
                </p>
              )}
              <Input
                autoFocus
                type={copy.type}
                aria-label={`New ${copy.noun}`}
                placeholder={copy.placeholder}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                disabled={send.isPending}
              />
              <Button type="submit" loading={send.isPending}>
                Send code
              </Button>
            </form>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length !== CODE_LENGTH) return toast.error(`Enter the ${CODE_LENGTH}-digit code`);
                confirm.mutate();
              }}
            >
              <p className="text-sm text-muted-foreground">
                Enter the {CODE_LENGTH}-digit code sent to{" "}
                <span className="font-medium text-foreground wrap-anywhere">{target.trim()}</span>.
              </p>
              <InputOTP
                autoFocus
                maxLength={CODE_LENGTH}
                value={code}
                onChange={setCode}
                disabled={confirm.isPending}
                aria-label="Verification code"
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <Button type="submit" loading={confirm.isPending} disabled={code.length !== CODE_LENGTH}>
                {applied ? "Confirm change" : "Confirm and send for approval"}
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => setStep(1)}
                >
                  Use a different {copy.noun}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                  disabled={send.isPending}
                  onClick={() => send.mutate(target.trim(), { onSuccess: () => toast.success("New code sent") })}
                >
                  Resend code
                </button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
