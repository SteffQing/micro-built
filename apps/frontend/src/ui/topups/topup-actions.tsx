"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { Icon, icons } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLoanStatusColor } from "@/config/status";
import { approveTopup, disburseTopup, rejectTopup } from "@/lib/mutations/admin/topups";
import { capitalize, cn, formatCurrency } from "@/lib/utils";
import { useUserProvider } from "@/store/auth";

type TopupStatus = "PENDING" | "APPROVED" | "DISBURSED" | "REJECTED";
const MAX_MONTHS = 120;

export function StatusBadge({ status }: { status: TopupStatus }) {
  return (
    <Badge variant="secondary" className={cn("border-transparent", getLoanStatusColor(status))}>
      {capitalize(status.toLowerCase())}
    </Badge>
  );
}

/** A 409 means another admin got there first: say so and refresh the lists. */
function useAlreadyDecided() {
  const queryClient = useQueryClient();
  return (err: unknown, close: () => void) => {
    if (isAxiosError(err) && err.response?.status === 409) {
      toast.error(err.response.data?.message ?? "Already decided by another admin");
      queryClient.invalidateQueries({ queryKey: ["/admin/loans/topups"] });
      close();
    }
  };
}

/** A top-up's tenure change only adds months: 0 (none) up. */
export function MonthsStepper({
  id,
  value,
  onChange,
  disabled,
  min = 0,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant="outline"
        aria-label="One month fewer"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Icon icon={icons.minus} size={14} />
      </Button>
      <div id={id} className="min-w-24 rounded-md border px-3 py-1.5 text-center text-sm font-semibold tabular-nums">
        {value === 0 ? "None" : `+${value} month${value === 1 ? "" : "s"}`}
      </div>
      <Button
        type="button"
        size="icon"
        variant="outline"
        aria-label="One month more"
        disabled={disabled || value >= MAX_MONTHS}
        onClick={() => onChange(Math.min(MAX_MONTHS, value + 1))}
      >
        <Icon icon={icons.plus} size={14} />
      </Button>
    </div>
  );
}

/** Whether added months also book interest on the running loan (lengthening only). */
export function RepriceCheckbox({
  id,
  months,
  checked,
  onChange,
  locked,
}: {
  id: string;
  months: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Shown checked and fixed (e.g. interest already booked). */
  locked?: boolean;
}) {
  const enabled = months > 0 && !locked;
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border p-3", months <= 0 && "opacity-60")}>
      <Checkbox
        id={id}
        className="mt-0.5"
        checked={months > 0 && checked}
        disabled={!enabled}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <div className="grid gap-1">
        <Label htmlFor={id} className="text-sm font-medium">
          Recalculate interest for the added months
        </Label>
        <p className="text-xs text-muted-foreground">
          {locked
            ? "Interest has already been booked for this change. It stays, so this can't be turned off."
            : months > 0
              ? "Also charges the running loan's principal still owed for each month added. Left off, only the top-up is charged interest."
              : "Only when months are added."}
        </p>
      </div>
    </div>
  );
}

function ApproveTopupDialog({
  topup,
  open,
  onOpenChange,
}: {
  topup: AdminTopupDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Starts at what was requested with the top-up; the approver may change or clear it.
  const requested = topup.tenureChange?.status === "PENDING" ? topup.tenureChange : null;
  const [monthsDelta, setMonthsDelta] = useState<number>(Math.max(0, requested?.monthsDelta ?? 0));
  const [reprice, setReprice] = useState(requested?.reprice ?? false);
  const approval = useMutation(approveTopup(topup.id));
  const onError = useAlreadyDecided();

  async function handleApprove() {
    try {
      await approval.mutateAsync({ monthsDelta, reprice: monthsDelta > 0 && reprice });
      onOpenChange(false);
    } catch (err) {
      onError(err, () => onOpenChange(false));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Approve top-up?</DialogTitle>
          <DialogDescription>
            {topup.customer.name}
            {topup.amount !== null && <> · {formatCurrency(topup.amount)}</>}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
          <Label htmlFor="approve-months" className="text-sm font-medium">
            Tenure change
          </Label>
          <MonthsStepper id="approve-months" value={monthsDelta} onChange={setMonthsDelta} />
          <p className="text-xs text-muted-foreground">
            {requested
              ? `Requested with the top-up: +${requested.monthsDelta} months. `
              : "No tenure change was requested. "}
            Applied when the top-up is disbursed.
          </p>
          <RepriceCheckbox id={`reprice-${topup.id}`} months={monthsDelta} checked={reprice} onChange={setReprice} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={approval.isPending}>
            Go back
          </Button>
          <Button loading={approval.isPending} onClick={handleApprove}>
            Confirm approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectTopupDialog({
  topup,
  open,
  onOpenChange,
}: {
  topup: AdminTopupDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const rejection = useMutation(rejectTopup(topup.id));
  const onError = useAlreadyDecided();
  const close = () => {
    onOpenChange(false);
    setNote("");
  };

  async function handleReject() {
    try {
      await rejection.mutateAsync(note.trim() ? { note: note.trim() } : undefined);
      close();
    } catch (err) {
      onError(err, close);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject this top-up?</DialogTitle>
          <DialogDescription>
            {topup.status === "APPROVED"
              ? `It was approved but not paid out. ${topup.customer.name} is told, and its tenure change goes with it.`
              : `${topup.customer.name} is told, and its tenure change goes with it.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 px-4 pb-4 sm:px-5 sm:pb-5">
          <Label htmlFor="reject-note" className="text-sm font-medium">
            Reason <span className="font-normal text-muted-foreground">(optional, shown to the customer)</span>
          </Label>
          <Textarea
            id="reject-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for rejection"
            className="min-h-[80px] resize-none"
            maxLength={1000}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={rejection.isPending}>
            Go back
          </Button>
          <Button variant="destructive" loading={rejection.isPending} onClick={handleReject}>
            Confirm rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DisburseTopupDialog({
  topup,
  open,
  onOpenChange,
}: {
  topup: AdminTopupDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Starts at the change approved with the top-up; the disbursing admin may still change or drop it.
  const approved = topup.tenureChange?.status === "APPROVED" ? topup.tenureChange : null;
  const [monthsDelta, setMonthsDelta] = useState<number>(approved?.monthsDelta ?? 0);
  const [reprice, setReprice] = useState(approved?.reprice ?? false);
  const disbursement = useMutation(disburseTopup(topup.id));
  const onError = useAlreadyDecided();

  async function handleDisburse() {
    try {
      await disbursement.mutateAsync({ monthsDelta, reprice: monthsDelta > 0 && reprice });
      onOpenChange(false);
    } catch (err) {
      onError(err, () => onOpenChange(false));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Disburse top-up?</DialogTitle>
          <DialogDescription>
            This pays {topup.amount !== null ? formatCurrency(topup.amount) : "the top-up"} to {topup.customer.name}
            &apos;s account and applies the tenure change below. It can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
          <Label htmlFor="disburse-months" className="text-sm font-medium">
            Tenure change
          </Label>
          <MonthsStepper id="disburse-months" value={monthsDelta} onChange={setMonthsDelta} />
          <p className="text-xs text-muted-foreground">
            {approved
              ? `Approved with the top-up: +${approved.monthsDelta} months${approved.reprice ? ", interest recalculated" : ""}. `
              : "No tenure change was approved. "}
            You can still change it; it applies now.
          </p>
          <RepriceCheckbox id={`disburse-reprice-${topup.id}`} months={monthsDelta} checked={reprice} onChange={setReprice} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disbursement.isPending}>
            Go back
          </Button>
          <Button loading={disbursement.isPending} onClick={handleDisburse}>
            Confirm disbursement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What can be done to a top-up next: approve or reject it while pending; reject or (super admins) disburse it
 * once approved.
 */
export function TopupActions({ topup }: { topup: AdminTopupDto }) {
  const { userRole } = useUserProvider();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [disburseOpen, setDisburseOpen] = useState(false);
  if (topup.status !== "PENDING" && topup.status !== "APPROVED") return null;

  const canDisburse = topup.status === "APPROVED" && userRole === "SUPER_ADMIN";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setRejectOpen(true)}
      >
        Reject
      </Button>
      {topup.status === "PENDING" && (
        <Button className="flex-1" onClick={() => setApproveOpen(true)}>
          Approve
        </Button>
      )}
      {canDisburse && (
        <Button className="flex-1" onClick={() => setDisburseOpen(true)}>
          Disburse
        </Button>
      )}
      {topup.status === "APPROVED" && !canDisburse && (
        <p className="w-full text-xs text-muted-foreground">Approved. A super admin disburses it.</p>
      )}
      <ApproveTopupDialog topup={topup} open={approveOpen} onOpenChange={setApproveOpen} />
      <RejectTopupDialog topup={topup} open={rejectOpen} onOpenChange={setRejectOpen} />
      <DisburseTopupDialog topup={topup} open={disburseOpen} onOpenChange={setDisburseOpen} />
    </div>
  );
}
