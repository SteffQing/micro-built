"use client";

import { Card } from "@/components/ui/card";
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
 * Per-page summary cards: aggregates the numeric columns of the rows currently
 * rendered (one page) into a small card row. Shared by every list table — each
 * passes its own field config, so the summation logic lives in one place.
 */
export function TableSummaryCards<T>({
  rows,
  fields,
  className,
}: TableSummaryCardsProps<T>) {
  if (!rows.length) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-3 lg:grid-cols-4",
        className
      )}
    >
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
          <Card
            key={field.label}
            className="gap-1 border bg-muted/40 p-3 shadow-none"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {field.label}
            </p>
            <p className="text-base font-semibold text-foreground">
              {formatValue(result, format)}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
