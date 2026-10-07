"use client";

import { cn, formatCurrency } from "@/lib/utils";

type AggType = "sum" | "avg";
type ValueFormat = "currency" | "number" | "percent";

export interface SummaryField<T> {
  label: string;
  /** Pulls the numeric value out of a row; null/undefined is treated as 0 (or skipped for avg). */
  value: (row: T) => number | null | undefined;
  /** How to display the aggregate. Defaults to "currency". */
  format?: ValueFormat;
  /** How to aggregate across the page. Defaults to "sum". */
  agg?: AggType;
}

interface TableSummaryCardsProps<T> {
  rows: T[];
  fields: SummaryField<T>[];
  className?: string;
}

function formatValue(value: number, format: ValueFormat): string {
  switch (format) {
    case "percent":
      return `${Math.round(value)}%`;
    case "number":
      return value.toLocaleString();
    case "currency":
    default:
      return formatCurrency(value);
  }
}

/**
 * Per-page totals: aggregates the numeric columns of the rows currently rendered (one page) into one quiet strip
 * above the table, labelled as this page's so it isn't read as an all-time figure. Shared by every list table; each
 * passes its own field config, so the summation logic lives in one place.
 */
export function TableSummaryCards<T>({
  rows,
  fields,
  className,
}: TableSummaryCardsProps<T>) {
  if (!rows.length) return null;

  return (
    <section
      aria-label="Totals for this page"
      className={cn(
        "mx-4 mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-muted/50 px-4 py-2.5",
        className
      )}
    >
      <p className="w-full text-xs text-muted-foreground sm:w-auto">
        This page{" "}
        <span className="tabular-nums">({rows.length.toLocaleString()})</span>
      </p>
      <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5">
        {fields.map((field) => {
          const agg = field.agg ?? "sum";
          const format = field.format ?? "currency";

          const values = rows
            .map((row) => field.value(row))
            .filter((v): v is number => typeof v === "number" && !isNaN(v));

          const total = values.reduce((acc, v) => acc + v, 0);
          const result =
            agg === "avg" ? (values.length ? total / values.length : 0) : total;

          return (
            <div key={field.label} className="flex items-baseline gap-1.5">
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd className="text-sm font-semibold tabular-nums text-foreground">
                {formatValue(result, format)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
