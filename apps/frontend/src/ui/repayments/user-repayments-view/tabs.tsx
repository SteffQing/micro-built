"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { userDeductions, userInflows } from "@/lib/queries/user/repayment";
import { formatCurrency, formatPeriodLabel } from "@/lib/utils";
import { PagedTableCard, StatusPill, formatDate } from "../admin-repayments-view/paged-table-card";

// Customer wording: what payroll is asked for, and the money that came in. No staff IDs, uploads or review states.

const deductionStatus: Record<DeductionStatus, { label: string; className: string; hint: string }> = {
  OPEN: { label: "Upcoming", className: "bg-muted text-muted-foreground", hint: "Not sent to payroll yet" },
  AWAITING: { label: "Sent to payroll", className: "bg-warning/10 text-warning", hint: "Waiting for payroll" },
  FULFILLED: { label: "Paid", className: "bg-success/10 text-success", hint: "" },
  PARTIAL: { label: "Part paid", className: "bg-brand/10 text-brand", hint: "" },
  FAILED: { label: "Missed", className: "bg-destructive/10 text-destructive", hint: "" },
};

const sourceLabels: Record<PaymentInflowSource, string> = {
  PAYROLL: "Payroll",
  LIQUIDATION: "Liquidation",
  IMPORT: "Paid before transfer",
};

const inflowState = (state: PaymentInflowState) =>
  state === "SETTLED"
    ? { label: "Applied", className: "bg-success/10 text-success" }
    : state === "REJECTED"
      ? { label: "Declined", className: "bg-destructive/10 text-destructive" }
      : { label: "Processing", className: "bg-warning/10 text-warning" };

const money = (value: number) => <span className="tabular-nums">{formatCurrency(value)}</span>;

const deductionColumns: ColumnDef<UserDeductionDto>[] = [
  {
    accessorKey: "period",
    header: "Month",
    cell: ({ row }) => <span className="whitespace-nowrap font-medium">{formatPeriodLabel(row.original.period)}</span>,
  },
  {
    accessorKey: "expected",
    header: "Deduction",
    meta: { align: "right" },
    cell: ({ row }) => money(row.original.expected),
  },
  { accessorKey: "paid", header: "Paid", meta: { align: "right" }, cell: ({ row }) => money(row.original.paid) },
  {
    accessorKey: "outstanding",
    header: "Unpaid",
    meta: { align: "right" },
    cell: ({ row }) =>
      row.original.status === "OPEN" || row.original.status === "AWAITING" ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        money(row.original.outstanding)
      ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = deductionStatus[row.original.status];
      return (
        <span title={status.hint || undefined}>
          <StatusPill label={status.label} className={status.className} />
        </span>
      );
    },
  },
];

const inflowColumns: ColumnDef<UserInflowDto>[] = [
  {
    accessorKey: "receivedAt",
    header: "Received",
    cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.receivedAt)}</span>,
  },
  {
    accessorKey: "period",
    header: "For",
    cell: ({ row }) => <span className="whitespace-nowrap">{formatPeriodLabel(row.original.period)}</span>,
  },
  {
    accessorKey: "source",
    header: "From",
    cell: ({ row }) => <span className="text-muted-foreground">{sourceLabels[row.original.source]}</span>,
  },
  { accessorKey: "amount", header: "Amount", meta: { align: "right" }, cell: ({ row }) => money(row.original.amount) },
  {
    accessorKey: "applied",
    header: "Applied to loan",
    meta: { align: "right" },
    cell: ({ row }) => money(row.original.applied),
  },
  {
    accessorKey: "state",
    header: "Status",
    cell: ({ row }) => <StatusPill {...inflowState(row.original.state)} />,
  },
];

export function UserDeductionsTab() {
  return (
    <PagedTableCard
      title="Deductions"
      description="What payroll is asked to deduct each month. Upcoming amounts can still change until they are sent."
      columns={deductionColumns}
      useList={(page, limit) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useQuery({ ...userDeductions({ page, limit }), placeholderData: (prev) => prev })
      }
      filterKey="deductions"
      emptyTitle="No deductions yet"
      emptyDescription="Your monthly deductions appear here once a loan is disbursed."
    />
  );
}

export function UserInflowsTab() {
  const [source, setSource] = useState<PaymentInflowSource | "ALL">("ALL");
  return (
    <PagedTableCard
      title="Payments received"
      description="Money received for your loan: payroll deductions and liquidations."
      columns={inflowColumns}
      useList={(page, limit) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useQuery({
          ...userInflows({ page, limit, ...(source !== "ALL" && { source }) }),
          placeholderData: (prev) => prev,
        })
      }
      filterKey={source}
      filters={
        <Select value={source} onValueChange={(v) => setSource(v as PaymentInflowSource | "ALL")}>
          <SelectTrigger className="h-9 w-44" aria-label="Filter by source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sources</SelectItem>
            <SelectItem value="PAYROLL">Payroll</SelectItem>
            <SelectItem value="LIQUIDATION">Liquidation</SelectItem>
            <SelectItem value="IMPORT">Paid before transfer</SelectItem>
          </SelectContent>
        </Select>
      }
      emptyTitle="No payments yet"
      emptyDescription="Payments from payroll or liquidations appear here when they arrive."
    />
  );
}
