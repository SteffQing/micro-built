"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { appliedRepayments } from "@/lib/queries/admin/repayment";
import { capitalize, formatCurrency, formatPeriodLabel } from "@/lib/utils";
import type { PeriodRangeValue } from "@/components/period-range-filter";
import {
  PagedTableCard,
  StatusPill,
  customerCell,
  formatDate,
  periodParams,
  useSearchState,
} from "./paged-table-card";

const muted = (value: number) => (
  <span className="tabular-nums text-muted-foreground">{formatCurrency(value)}</span>
);

const columns: ColumnDef<AppliedRepaymentListItemDto>[] = [
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
    id: "source",
    header: "Source",
    cell: ({ row }) => (
      <StatusPill
        label={capitalize(row.original.source.toLowerCase())}
        className={
          row.original.source === "LIQUIDATION"
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        }
      />
    ),
  },
  {
    id: "amount",
    header: "Amount",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.original.amount)}</span>
    ),
  },
  { id: "principal", header: "Principal", meta: { align: "right" }, cell: ({ row }) => muted(row.original.principal) },
  { id: "interest", header: "Interest", meta: { align: "right" }, cell: ({ row }) => muted(row.original.interest) },
  { id: "penalty", header: "Penalty", meta: { align: "right" }, cell: ({ row }) => muted(row.original.penalty) },
  {
    id: "createdAt",
    header: "Applied",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
];

const ALL_TIME: PeriodRangeValue = { from: "", to: "" };

/** Scope to one customer (their profile page): filters by `customerId`, drops the Customer column and renders bare. */
type ScopeProps = { period?: PeriodRangeValue; customerId?: string };
export function AppliedTab({ period = ALL_TIME, customerId }: ScopeProps) {
  const [search, setSearch, debouncedSearch] = useSearchState();

  const params: FilterAppliedRepayments = {
    ...periodParams(period),
    ...(customerId && { customerId }),
    ...(debouncedSearch && { search: debouncedSearch }),
  };

  return (
    <PagedTableCard
      title="Repayments"
      description="Inflow amounts applied to loans, split into principal, interest and penalty"
      columns={customerId ? columns.filter((c) => c.id !== "customer") : columns}
      bare={Boolean(customerId)}
      useList={(page, limit) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useQuery({ ...appliedRepayments({ ...params, page, limit }), placeholderData: (prev) => prev })
      }
      filterKey={JSON.stringify(params)}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={customerId ? "Search loan or period" : "Search customer, IPPIS ID or loan"}
      emptyTitle="No repayments applied"
      emptyDescription="No repayments match the current filters."
    />
  );
}
