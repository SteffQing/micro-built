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
import { DetailRowsSkeleton } from "@/components/page-skeleton";

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="shrink-0 text-sm text-muted-foreground">{title}</p>
      <div className="min-w-0 text-right text-sm font-medium text-foreground [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

function tenureChangeText(change: NonNullable<UserMicroLoan["tenureChange"]>) {
  const months = Math.abs(change.monthsDelta);
  const sign = change.monthsDelta < 0 ? "−" : "+";
  return `${sign}${months} month${months === 1 ? "" : "s"} (${capitalize(change.status.toLowerCase())})`;
}

/**
 * One micro-loan from the customer's history: a loan's first payout or a top-up, then the loan it belongs to (read
 * from GET /user/loan/:loanId for its current figures).
 */
export function UserMicroLoanModal({
  item,
  open: openProp,
  onOpenChange,
}: {
  item: UserMicroLoan;
  /** Controlled from outside (a notification link): no View button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOpenState(next));
  const { data, isLoading, error } = useQuery({ ...userCashLoanQuery(item.loanId), enabled: open });
  const loan = data?.data;
  const isTopup = item.purpose === "TOPUP";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs">
            <Icon icon={icons.view} size={12} className="mr-1" />
            View
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isTopup ? "Top-up Details" : "Loan Payout Details"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 p-4 sm:p-5">
          <Detail title={isTopup ? "Top-up Amount" : "Amount Paid Out"}>{formatCurrency(item.amount)}</Detail>
          {item.assetName && <Detail title="Asset">{item.assetName}</Detail>}
          <Detail title="Status">
            <Badge variant="secondary" className={cn("border-transparent", getLoanStatusColor(item.status))}>
              {capitalize(item.status.toLowerCase())}
            </Badge>
          </Detail>
          {isTopup && <Detail title="Requested">{format(new Date(item.requestedAt), "PPP")}</Detail>}
          {item.disbursedAt && <Detail title="Disbursed">{format(new Date(item.disbursedAt), "PPP")}</Detail>}
          {item.tenureChange && <Detail title="Tenure Change">{tenureChangeText(item.tenureChange)}</Detail>}

          <Separator className="bg-border" />
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isTopup ? "Added to loan" : "Part of loan"}
          </p>
          {isLoading ? (
            <DetailRowsSkeleton rows={3} />
          ) : error || !loan ? (
            <p className="text-sm text-destructive">{error?.message ?? "The loan could not be loaded."}</p>
          ) : (
            <>
              <Detail title="Loan ID">{loan.id}</Detail>
              <Detail title="Loan Type">{capitalize(loan.category.replace(/_/g, " ").toLowerCase())}</Detail>
              <Detail title="Outstanding">{formatCurrency(loan.outstanding)}</Detail>
              {loan.monthly !== null && <Detail title="Monthly Deduction">{formatCurrency(loan.monthly)}</Detail>}
              {loan.remainingMonths > 0 && (
                <Detail title="Months Left">
                  {loan.remainingMonths} month{loan.remainingMonths === 1 ? "" : "s"}
                </Detail>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
