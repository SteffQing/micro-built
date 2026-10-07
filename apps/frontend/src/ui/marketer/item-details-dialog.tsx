"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
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
import { Skeleton } from "@/components/ui/skeleton";
import { marketerAssetRequest, marketerLoan, marketerTopup } from "@/lib/queries/marketer";
import { capitalize, cn, formatCurrency } from "@/lib/utils";

const date = (value: string | Date | null | undefined) => (value ? format(new Date(value), "d MMM yyyy") : "—");
const money = (value: number | null | undefined) => (value === null || value === undefined ? "—" : formatCurrency(value));
const words = (value: string) => capitalize(value.toLowerCase().replace(/_/g, " "));

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="truncate text-sm font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function LoanRows({ id }: { id: string }) {
  const { data, isLoading } = useQuery(marketerLoan(id));
  const loan = data?.data;
  if (isLoading || !loan) return <Skeleton className="h-40 w-full" />;
  return (
    <Rows
      rows={[
        ["Customer", loan.borrower.name],
        ["Loan", loan.id],
        ["Type", words(loan.category)],
        ["Status", words(loan.status)],
        ["Amount", money(loan.principal)],
        ["Tenure", loan.tenure ? `${loan.tenure} months` : "Set at approval"],
        ["Monthly deduction", money(loan.monthly)],
        ["Requested", date(loan.createdAt)],
        ["Disbursed", date(loan.disbursementDate)],
        ["Repaid", money(loan.repaid)],
        ["Outstanding", money(loan.outstanding)],
      ]}
    />
  );
}

function AssetRows({ id }: { id: string }) {
  const { data, isLoading } = useQuery(marketerAssetRequest(id));
  const request = data?.data;
  if (isLoading || !request) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="grid gap-4">
      <Rows
        rows={[
          ["Customer", request.borrower.name],
          ["Asset", request.name],
          ["Kind", request.kind === "TOPUP" ? "Asset top-up" : "New asset loan"],
          ["Review", words(request.status)],
          ["Amount", request.amount === null ? "Set at approval" : money(request.amount)],
          ["Loan", request.loanId ?? "—"],
          ["Requested", date(request.createdAt)],
          ["Top-up", request.topup ? words(request.topup.status) : "—"],
        ]}
      />
      {request.publicDetails && (
        <div>
          <p className="text-xs text-muted-foreground">Details</p>
          <p className="text-sm">{request.publicDetails}</p>
        </div>
      )}
    </div>
  );
}

function TopupRows({ id }: { id: string }) {
  const { data, isLoading } = useQuery(marketerTopup(id));
  const topup = data?.data;
  if (isLoading || !topup) return <Skeleton className="h-40 w-full" />;
  return (
    <Rows
      rows={[
        ["Customer", topup.customer.name],
        ["Loan", topup.loanId],
        ["Status", words(topup.status)],
        ["Amount", money(topup.amount)],
        ["Asset", topup.asset?.name ?? "Cash"],
        [
          "Tenure change",
          topup.tenureChange ? `+${topup.tenureChange.monthsDelta} months (${words(topup.tenureChange.status)})` : "None",
        ],
        ["Requested", date(topup.requestedAt)],
        ["Disbursed", date(topup.disbursedAt)],
        ...(topup.rejectionNote ? ([["Why it was rejected", topup.rejectionNote]] as [string, ReactNode][]) : []),
      ]}
    />
  );
}

const TITLES: Record<EscalationKind, string> = {
  LOAN: "Loan details",
  ASSET_REQUEST: "Asset request",
  TOPUP: "Top-up",
};

/** Read-only details of a customer's loan, asset request or top-up, for a marketer (admins decide and disburse). */
export function ItemDetailsDialog({ kind, id, trigger }: { kind: EscalationKind; id: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost" className="h-8">
            Details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="grid-cols-1 gap-0 sm:max-w-lg">
        <DialogHeader className="border-b">
          <DialogTitle>{TITLES[kind]}</DialogTitle>
          <DialogDescription>Approval and disbursement are done by admins. Escalate it if it&apos;s waiting too long.</DialogDescription>
        </DialogHeader>
        <div className={cn(dialogBodyClass, "pt-4")}>
          {open &&
            (kind === "LOAN" ? <LoanRows id={id} /> : kind === "TOPUP" ? <TopupRows id={id} /> : <AssetRows id={id} />)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
