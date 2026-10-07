"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { customerLoans } from "@/lib/queries/admin/customer";
import { resolveRepayment } from "@/lib/mutations/admin/repayments";
import { cn, formatCurrency } from "@/lib/utils";

interface DetailsProps {
  repayment: SingleRepaymentWithUserDto | SingleUserRepaymentDto;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

type Action = "APPLY" | "SETTLE" | "REJECT";

function Row({ title, content }: { title: string; content: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm font-normal text-muted-foreground">{title}</p>
      <p className="min-w-0 break-words text-right text-sm font-medium text-foreground">{content}</p>
    </div>
  );
}

function Choice({
  value,
  current,
  onPick,
  title,
  description,
  disabled,
}: {
  value: Action;
  current: Action;
  onPick: (value: Action) => void;
  title: string;
  description: React.ReactNode;
  disabled?: boolean;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={() => onPick(value)}
      className={cn(
        "grid gap-1 rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <span
          aria-hidden
          className={cn(
            "grid size-4 place-items-center rounded-full border",
            active ? "border-primary" : "border-muted-foreground/50",
          )}
        >
          {active && <span className="size-2 rounded-full bg-primary" />}
        </span>
        {title}
      </span>
      <span className="pl-6 text-xs leading-5 text-muted-foreground">{description}</span>
    </button>
  );
}

/**
 * A payroll payment the voucher couldn't place on its own. What fits depends on where it is:
 * - nothing applied yet: APPLY it to the customer's one running loan, or REJECT it (it isn't ours to keep);
 * - part applied, the rest more than was owed: SETTLE once that excess has been refunded.
 */
export function ManualResolution({
  repayment,
  isOpen,
  onOpenChange,
}: DetailsProps) {
  // Only the admin side reaches this (MANUAL_RESOLUTION).
  const admin = repayment as SingleRepaymentWithUserDto;
  const hasUser = Boolean(admin.customer);
  const partlyApplied = Boolean(admin.repayment);

  const [action, setAction] = useState<Action>(partlyApplied ? "SETTLE" : "APPLY");
  const [customerId, setCustomerId] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const { data: loansData, isLoading: loansLoading } = useQuery({
    ...customerLoans(admin.customer?.id ?? ""),
    enabled: isOpen && hasUser && !partlyApplied,
  });
  // A customer has one running loan at a time; the payment goes to it.
  const loan = loansData?.data?.activeLoans?.[0] ?? null;

  // The mutation toasts and invalidates; this only closes the dialog.
  const { mutate, isPending } = useMutation(resolveRepayment(admin.id));

  const target = hasUser ? admin.customer!.id : customerId.trim();
  const needsNote = action !== "APPLY";
  const canSubmit =
    (!needsNote || note.trim().length > 0) &&
    (action !== "APPLY" || (hasUser ? Boolean(loan) : Boolean(target)));

  const handleSubmit = () => {
    if (!canSubmit) return;
    mutate(
      {
        action,
        ...(note.trim() && { note: note.trim() }),
        ...(action === "APPLY" && { customerId: target }),
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const period = admin.period;
  const excess = admin.amount - (admin.repayment?.amount ?? 0);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Resolve payment</DialogTitle>
      </DialogHeader>

      <Separator className="bg-border" />

      <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="grid gap-3">
          <Row title="Amount" content={formatCurrency(admin.amount)} />
          <Row title="Payroll month" content={period} />
          <Row
            title="Customer"
            content={admin.customer ? admin.customer.name : "Not found (no IPPIS match)"}
          />
          {partlyApplied && (
            <>
              <Row title="Applied to loan" content={`${formatCurrency(admin.repayment!.amount)} · ${admin.repayment!.loanId}`} />
              <Row title="More than owed" content={formatCurrency(excess)} />
            </>
          )}
        </div>

        <Separator className="bg-border" />

        <div role="radiogroup" aria-label="Resolution" className="grid gap-2">
          {partlyApplied ? (
            <Choice
              value="SETTLE"
              current={action}
              onPick={setAction}
              title="Mark the excess refunded"
              description={`What the loan owed is already paid from this. Refund the ${formatCurrency(excess)} left over to the customer, then close it here.`}
            />
          ) : (
            <>
              <Choice
                value="APPLY"
                current={action}
                onPick={setAction}
                title="Apply to their loan"
                description={
                  admin.deduction
                    ? `Pays the loan's ${admin.deduction.period} deduction; anything beyond it waits here to be refunded.`
                    : `Their loan has no ${period} deduction (for example it started later), so this counts as an early payment: it lowers what they still owe and their next deductions.`
                }
              />
              <Choice
                value="REJECT"
                current={action}
                onPick={setAction}
                title="Reject"
                description="The money isn't for any loan here (deducted by mistake, or someone else's). Nothing is recorded against a loan; refund it to the customer outside the app."
              />
            </>
          )}
        </div>

        {action === "APPLY" &&
          (hasUser ? (
            loansLoading ? (
              <p className="text-sm text-muted-foreground">Loading their loan…</p>
            ) : loan ? (
              <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
                <p className="text-xs text-muted-foreground">Pays loan</p>
                <p className="font-medium">
                  {loan.id} · {formatCurrency(loan.outstanding)} outstanding
                </p>
              </div>
            ) : (
              <p className="text-sm text-destructive">
                This customer has no running loan to apply it to. Reject it and refund them instead.
              </p>
            )
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="customerId">Customer ID</Label>
              <Input
                id="customerId"
                placeholder="e.g. MB-HOWP2"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                No IPPIS match was found for this payment. Enter the customer it belongs to; it pays their running loan.
              </p>
            </div>
          ))}

        <div className="grid gap-2">
          <Label htmlFor="note">Note{needsNote ? "" : " (optional)"}</Label>
          <Textarea
            id="note"
            placeholder={
              action === "SETTLE"
                ? "How and when the excess was refunded"
                : action === "REJECT"
                  ? "Why it isn't ours, and how it's being refunded"
                  : "Reference for this decision"
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="flex-1 rounded-[8px] bg-muted p-2.5 text-sm font-medium text-muted-foreground"
        >
          Close
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || isPending}
          variant={action === "REJECT" ? "destructive" : "default"}
          className="flex-1 rounded-[8px] p-2.5 text-sm font-medium"
        >
          {isPending ? (
            <Icon icon={icons.loaderCircle} size={16} className="animate-spin" />
          ) : action === "APPLY" ? (
            "Apply"
          ) : action === "SETTLE" ? (
            "Mark refunded"
          ) : (
            "Reject"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
