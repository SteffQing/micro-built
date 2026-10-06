"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { adminTopup } from "@/lib/queries/admin/topups";
import { capitalize, formatCurrency } from "@/lib/utils";
import { CashLoanModal } from "../modals";
import { StatusBadge, TopupActions } from "./topup-actions";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium wrap-anywhere">{children}</dd>
    </div>
  );
}

/** One top-up with what can be done to it next (approve, reject, disburse), opened from wherever it is listed. */
export function TopupDetailsModal({
  id,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  id: string;
  trigger?: ReactNode;
  /** Controlled from outside (a notification link), with no trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOpenState(next));
  const { data, isLoading } = useQuery({ ...adminTopup(id), enabled: open });
  const topup = data?.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{topup?.status === "PENDING" ? "Review Top-up" : "Top-up"}</DialogTitle>
          <DialogDescription>{topup ? `On loan ${topup.loanId}` : "Loading…"}</DialogDescription>
        </DialogHeader>
        <div className={dialogBodyClass}>
          {isLoading || !topup ? (
            <div className="grid gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : (
            <>
              <dl className="divide-y">
                <Row label="Customer">{topup.customer.name}</Row>
                <Row label="Amount">{topup.amount === null ? "Set at approval" : formatCurrency(topup.amount)}</Row>
                <Row label="Status">
                  <StatusBadge status={topup.status} />
                </Row>
                <Row label="Requested">{format(new Date(topup.requestedAt), "d MMM yyyy")}</Row>
                {topup.disbursedAt && <Row label="Disbursed">{format(new Date(topup.disbursedAt), "d MMM yyyy")}</Row>}
                <Row label="Tenure change">
                  {topup.tenureChange && topup.tenureChange.status !== "REJECTED"
                    ? `+${topup.tenureChange.monthsDelta} months${topup.tenureChange.reprice ? ", interest recalculated" : ""} (${capitalize(topup.tenureChange.status.toLowerCase())})`
                    : "None"}
                </Row>
                {topup.asset && <Row label="Asset">{topup.asset.name}</Row>}
              </dl>
              {topup.status === "REJECTED" && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-destructive">Rejection note</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">
                    {topup.rejectionNote ?? "No reason was given."}
                  </p>
                </div>
              )}
              <div className="flex justify-start">
                <CashLoanModal
                  id={topup.loanId}
                  trigger={
                    <button type="button" className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      See the loan it tops up
                    </button>
                  }
                />
              </div>
              <TopupActions topup={topup} />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
