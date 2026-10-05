"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { allRepayments } from "@/lib/queries/admin/repayment";
import type { PeriodRangeValue } from "@/components/period-range-filter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExportButton } from "@/ui/tables/export-button";
import { PagedTableCard, periodParams, useSearchState } from "../paged-table-card";
import columns from "./columns";

type SourceFilter = "ALL" | PaymentInflowSource;

const SOURCES: { value: SourceFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PAYROLL", label: "Payroll" },
  { value: "LIQUIDATION", label: "Liquidation" },
];

const STATES: { value: PaymentInflowState; label: string }[] = [
  { value: "AWAITING", label: "Awaiting" },
  { value: "SETTLED", label: "Settled" },
  { value: "REVIEWING", label: "Reviewing" },
  { value: "UNMATCHED", label: "Unmatched" },
  { value: "REJECTED", label: "Rejected" },
];

/** Money received: payroll rows and liquidations, newest first. */
const ALL_TIME: PeriodRangeValue = { from: "", to: "" };

/** Scope to one customer (their profile page): filters by `customerId`, drops the Customer column and renders bare. */
type ScopeProps = { period?: PeriodRangeValue; customerId?: string };
export default function InflowsTable({ period = ALL_TIME, customerId }: ScopeProps) {
  const [search, setSearch, debouncedSearch] = useSearchState();
  const [source, setSource] = useState<SourceFilter>("ALL");
  const [state, setState] = useState<PaymentInflowState | "ALL">("ALL");

  const params: FilterRepayments = {
    ...periodParams(period),
    ...(customerId && { customerId }),
    ...(source !== "ALL" && { source }),
    ...(state !== "ALL" && { state }),
    ...(debouncedSearch && { search: debouncedSearch }),
  };

  return (
    <PagedTableCard
      title="Inflows"
      description="Money received from payroll and liquidations, newest first"
      columns={customerId ? columns.filter((c) => c.id !== "customer") : columns}
      bare={Boolean(customerId)}
      useList={(page, limit) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useQuery({
          ...allRepayments({ ...params, page, limit }),
          placeholderData: (prev) => prev,
          refetchInterval: 15_000,
        })
      }
      filterKey={JSON.stringify(params)}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={customerId ? "Search loan or period" : "Search customer, IPPIS ID or staff ID"}
      // The export endpoint ignores the customer filter, so a scoped table would export everything.
      actions={customerId ? undefined : <ExportButton path="/admin/exports/repayments" filters={params} />}
      filters={
        <>
          <div role="group" aria-label="Source" className="inline-flex h-9 items-center rounded-lg bg-muted p-0.5 text-xs font-medium">
            {SOURCES.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={source === s.value}
                onClick={() => setSource(s.value as SourceFilter)}
                className="h-full rounded-md px-3 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
              >
                {s.label}
              </button>
            ))}
          </div>
          <Select value={state} onValueChange={(v) => setState(v as PaymentInflowState | "ALL")}>
            <SelectTrigger className="w-[140px] text-sm data-[size=default]:h-9" aria-label="Payment state">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All states</SelectItem>
              {STATES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      emptyTitle="No inflows"
      emptyDescription="No payments match the current filters."
    />
  );
}
