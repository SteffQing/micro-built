"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Icon, icons } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { getLoanStatusColor } from "@/config/status";
import { userCashLoanQuery } from "@/lib/queries/user/loan";
import { capitalize, cn, formatCurrency } from "@/lib/utils";

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="shrink-0 text-sm text-muted-foreground">{title}</p>
      <div className="min-w-0 text-right text-sm font-medium text-foreground [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

function tenureChangeText(change: NonNullable<UserLoanTopup["tenureChange"]>) {
  const months = Math.abs(change.monthsDelta);
  const sign = change.monthsDelta < 0 ? "−" : "+";
  return `${sign}${months} month${months === 1 ? "" : "s"} (${capitalize(change.status.toLowerCase())})`;
}

/**
 * One cash top-up from the customer's request history: the top-up itself, then the running loan it adds to. The
 * API has no top-up endpoint for customers, so it is read from its loan (GET /user/loans/:loanId → topups).
 */
export function UserTopupModal({ id, loanId }: { id: string; loanId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useQuery({ ...userCashLoanQuery(loanId), enabled: open });
  const loan = data?.data;
  const topup = loan?.topups?.find((t) => t.id === id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <Icon icon={icons.view} size={12} className="mr-1" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Top-up Details</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center px-4 pb-8 sm:px-5">
            <Icon icon={icons.loaderCircle} size={32} className="animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Fetching top-up…</p>
          </div>
        ) : error || !loan || !topup ? (
          <p className="px-4 pb-5 text-center text-sm text-destructive sm:px-5">
            {error?.message ?? "This top-up could not be found."}
          </p>
        ) : (
          <div className="grid gap-4 p-4 sm:p-5">
            <Detail title="Top-up Amount">{formatCurrency(topup.amount)}</Detail>
            <Detail title="Status">
              <Badge variant="secondary" className={cn("border-transparent", getLoanStatusColor(topup.status))}>
                {capitalize(topup.status.toLowerCase())}
              </Badge>
            </Detail>
            <Detail title="Requested">{format(new Date(topup.requestedAt), "PPP")}</Detail>
            {topup.disbursedAt && <Detail title="Disbursed">{format(new Date(topup.disbursedAt), "PPP")}</Detail>}
            {topup.tenureChange && <Detail title="Tenure Change">{tenureChangeText(topup.tenureChange)}</Detail>}

            <Separator className="bg-border" />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Added to loan</p>
            <Detail title="Loan ID">{loan.id}</Detail>
            <Detail title="Loan Type">{capitalize(loan.category.replace(/_/g, " ").toLowerCase())}</Detail>
            <Detail title="Outstanding">{formatCurrency(loan.outstanding)}</Detail>
            {loan.monthly !== null && <Detail title="Monthly Deduction">{formatCurrency(loan.monthly)}</Detail>}
            {loan.remainingMonths > 0 && (
              <Detail title="Months Left">
                {loan.remainingMonths} month{loan.remainingMonths === 1 ? "" : "s"}
              </Detail>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
