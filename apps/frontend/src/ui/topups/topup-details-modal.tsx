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
import { ActionCell, StatusBadge } from "./topups-table";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium wrap-anywhere">{children}</dd>
    </div>
  );
}

/** One top-up with what can be done to it next (approve, reject, disburse), opened from wherever it is listed. */
export function TopupDetailsModal({ id, trigger }: { id: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ ...adminTopup(id), enabled: open });
  const topup = data?.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Top-up</DialogTitle>
          <DialogDescription>
            {topup ? `${topup.customer.name} · on loan ${topup.loanId}` : "Loading…"}
          </DialogDescription>
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
                <Row label="Amount">{topup.amount === null ? "Set at approval" : formatCurrency(topup.amount)}</Row>
                <Row label="Status">
                  <StatusBadge status={topup.status} />
                </Row>
                <Row label="Requested">{format(new Date(topup.requestedAt), "d MMM yyyy")}</Row>
                {topup.disbursedAt && <Row label="Disbursed">{format(new Date(topup.disbursedAt), "d MMM yyyy")}</Row>}
                <Row label="Tenure change">
                  {topup.tenureChange
                    ? `+${topup.tenureChange.monthsDelta} months (${capitalize(topup.tenureChange.status.toLowerCase())})`
                    : "None"}
                </Row>
                {topup.asset && <Row label="Asset">{topup.asset.name}</Row>}
              </dl>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                <CashLoanModal
                  id={topup.loanId}
                  trigger={
                    <button type="button" className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      See the loan it tops up
                    </button>
                  }
                />
                <ActionCell row={topup} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
