"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { deductionsList } from "@/lib/queries/admin/repayment";
import { getDeductionStatusBadge } from "@/config/status";
import { cn, formatCurrency, formatPeriodLabel } from "@/lib/utils";
import type { PeriodRangeValue } from "@/components/period-range-filter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PagedTableCard,
  StatusPill,
  customerCell,
  formatDate,
  periodParams,
  useSearchState,
} from "./paged-table-card";

const STATUSES: { value: DeductionStatus; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "AWAITING", label: "Awaiting" },
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "PARTIAL", label: "Partial" },
  { value: "FAILED", label: "Failed" },
];

const date = (value: string | null) => (
  <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(value)}</span>
);

const columns: ColumnDef<DeductionListItemDto>[] = [
  { id: "customer", header: "Customer", cell: ({ row }) => customerCell(row.original.customer) },
  {
    id: "period",
    header: "Period",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">{formatPeriodLabel(row.original.period.label)}</span>
    ),
  },
  {
    id: "loan",
    header: "Loan",
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.loanId}</span>,
  },
  {
    id: "expected",
    header: "Expected",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.original.expected)}</span>
    ),
  },
  {
    id: "paid",
    header: "Paid",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.original.paid)}</span>
    ),
  },
  {
    id: "outstanding",
    header: "Outstanding",
    meta: { align: "right" },
    cell: ({ row }) => {
      const { outstanding, status } = row.original;
      // Open and awaiting months are not owed yet, so only a closed shortfall reads as a problem.
      const owed = outstanding > 0 && (status === "PARTIAL" || status === "FAILED");
      return (
        <span className={cn("font-medium tabular-nums", owed && "text-destructive")}>
          {formatCurrency(outstanding)}
        </span>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusPill {...getDeductionStatusBadge(row.original.status)} />,
  },
  { id: "settledAt", header: "Settled", cell: ({ row }) => date(row.original.settledAt) },
  { id: "penalizedAt", header: "Penalised", cell: ({ row }) => date(row.original.penalizedAt) },
];

const ALL_TIME: PeriodRangeValue = { from: "", to: "" };

/** Scope to one customer (their profile page): filters by `customerId`, drops the Customer column and renders bare. */
type ScopeProps = { period?: PeriodRangeValue; customerId?: string };
export function DeductionsTab({ period = ALL_TIME, customerId }: ScopeProps) {
  const [search, setSearch, debouncedSearch] = useSearchState();
  const [status, setStatus] = useState<DeductionStatus | "ALL">("ALL");

  const params: FilterDeductions = {
    ...periodParams(period),
    ...(customerId && { customerId }),
    ...(status !== "ALL" && { status }),
    ...(debouncedSearch && { search: debouncedSearch }),
  };

  return (
    <PagedTableCard
      title="Deductions"
      description="What each loan is expected to pay per payroll month"
      columns={customerId ? columns.filter((c) => c.id !== "customer") : columns}
      bare={Boolean(customerId)}
      useList={(page, limit) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useQuery({ ...deductionsList({ ...params, page, limit }), placeholderData: (prev) => prev })
      }
      filterKey={JSON.stringify(params)}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={customerId ? "Search loan or period" : "Search customer, IPPIS ID or loan"}
      filters={
        <Select value={status} onValueChange={(v) => setStatus(v as DeductionStatus | "ALL")}>
          <SelectTrigger className="h-9 w-[150px] text-sm" aria-label="Deduction status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      emptyTitle="No deductions"
      emptyDescription="No deductions match the current filters."
    />
  );
}
