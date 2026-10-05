"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { barX, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon, icons } from "@/components/icon";
import type { PeriodRangeValue } from "@/components/period-range-filter";
import { chartHostStyle, chartTheme, formatCompactNaira, formatPercent } from "@/components/charts/theme";
import { disbursementChart } from "@/lib/queries/admin/dashboard";
import { formatCurrency } from "@/lib/utils";

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

const ROW_HEIGHT = 30;
const AXIS_HEIGHT = 36;

/**
 * There is no per-category endpoint, so the amounts are the `categories` of the disbursement chart
 * summed over the selected period (the same query the dashboard chart uses, so it is shared in cache).
 */
export default function LoanCategoryDistribution({ period }: { period: PeriodRangeValue }) {
  const range = period.from && period.to ? period : undefined;
  const { data, isLoading, error, refetch, isRefetching } = useQuery(disbursementChart(range));

  const { rows, total } = useMemo(() => {
    const sums = new Map<string, number>();
    for (const entry of data ?? []) {
      for (const [category, amount] of Object.entries(entry.categories)) {
        if (typeof amount === "number") sums.set(category, (sums.get(category) ?? 0) + amount);
      }
    }
    const total = [...sums.values()].reduce((sum, v) => sum + v, 0);
    const rows = [...sums.entries()]
      .filter(([, amount]) => amount > 0)
      .map(([category, amount]) => ({ category, label: titleCase(category), amount, share: total ? amount / total : 0 }))
      .sort((a, b) => b.amount - a.amount);
    return { rows, total };
  }, [data]);

  const definition = useMemo(
    () =>
      defineChart(
        {
          marks: [barX(rows, { x: "amount", y: "label", key: "category", fill: "var(--chart-2)", radius: 3 })],
          scales: {
            x: {
              scale: scaleLinear,
              nice: true,
              grid: true,
              axis: { line: false, ticks: { count: 4, format: formatCompactNaira } },
            },
            y: {
              scale: () => scaleBand<string>().padding(0.25),
              axis: { line: false, ticks: { size: 0 } },
            },
          },
          theme: chartTheme,
        },
        {
          tooltip: {
            use: tooltip,
            content: (points) => {
              const datum = points[0]?.datum;
              if (!datum) return { rows: [] };
              return {
                title: datum.label,
                rows: [
                  { label: "Disbursed", value: formatCurrency(datum.amount) },
                  { label: "Share", value: formatPercent(datum.share) },
                ],
              };
            },
          },
        },
      ),
    [rows],
  );

  const summary =
    `Bar chart of ${formatCurrency(total)} disbursed by loan category: ` +
    rows.map((r) => `${r.label} ${formatCurrency(r.amount)} (${formatPercent(r.share)})`).join(", ") +
    ".";

  return (
    <Card className="h-full gap-4 rounded-xl border-border bg-card shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 sm:px-6">
        <div className="min-w-0">
          <CardTitle className="text-lg font-semibold">Loan Category Distribution</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Disbursed by category</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Refresh loan category distribution"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <Icon icon={icons.refresh} size={16} className={isRefetching ? "animate-spin" : ""} />
        </Button>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {isLoading ? (
          <div aria-busy="true" className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5" style={{ width: `${90 - i * 15}%` }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <p role="alert" className="py-8 text-center text-sm text-destructive">
            Could not load loan categories: {(error as Error).message}
          </p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <p className="text-sm">No disbursements in this period</p>
            <p className="mt-1 text-xs">Pick another period or check back after disbursement</p>
          </div>
        ) : (
          <div className="space-y-5">
            <Chart
              definition={definition}
              height={rows.length * ROW_HEIGHT + AXIS_HEIGHT}
              ariaLabel={summary}
              style={chartHostStyle}
            />
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.category} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="size-3 shrink-0 rounded-full bg-chart-2" />
                    <span className="truncate text-sm text-muted-foreground">{r.label}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">
                    <span className="font-medium">{formatCurrency(r.amount)}</span>
                    <span className="ml-2 text-muted-foreground">{formatPercent(r.share)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
