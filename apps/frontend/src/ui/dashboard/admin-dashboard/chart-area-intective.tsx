"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { defineChart, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { parseYm, periodLabel } from "@microbuilt/shared";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PeriodRangeFilter, { type PeriodRangeValue } from "@/components/period-range-filter";
import { chartHostStyle, chartTheme, formatCompactNaira } from "@/components/charts/theme";
import { disbursementChart } from "@/lib/queries/admin/dashboard";
import { formatCurrency } from "@/lib/utils";

type Props = {
  period: PeriodRangeValue;
};

type Row = {
  period: string;
  total: number;
  categories: Partial<Record<string, number>>;
};

const labelFor = (ym: string) => {
  try {
    return periodLabel(parseYm(ym));
  } catch {
    return ym;
  }
};

const titleCase = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

export default function LoanDisbursementChart({ period }: Props) {
  const range = period.from && period.to ? period : undefined;
  const { data, isLoading, error } = useQuery(disbursementChart(range));

  const rows = useMemo<Row[]>(
    () => (data ?? []).map(({ period, total, categories }) => ({ period, total, categories })),
    [data],
  );

  const definition = useMemo(
    () =>
      defineChart(
        {
          marks: [
            lineY(rows, {
              x: "period",
              y: "total",
              stroke: "var(--chart-2)",
              strokeWidth: 2,
              points: true,
            }),
          ],
          scales: {
            x: {
              scale: () => scalePoint<string>().padding(0.2),
              axis: {
                line: false,
                ticks: { format: labelFor },
                tickLabels: { thin: true },
              },
            },
            y: {
              scale: scaleLinear,
              nice: true,
              grid: true,
              axis: { line: false, ticks: { count: 5, format: formatCompactNaira } },
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
              const categoryRows = Object.entries(datum.categories)
                .filter((entry): entry is [string, number] => typeof entry[1] === "number")
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => ({ label: titleCase(category), value: formatCurrency(amount) }));
              return {
                title: labelFor(datum.period),
                rows: [...categoryRows, { label: "Total", value: formatCurrency(datum.total), active: true }],
              };
            },
          },
        },
      ),
    [rows],
  );

  const summary = useMemo(() => {
    if (!rows.length) return "No disbursements for the selected period.";
    const grand = rows.reduce((sum, row) => sum + row.total, 0);
    const peak = rows.reduce((best, row) => (row.total > best.total ? row : best), rows[0]);
    return (
      `Line chart of loan disbursements per month from ${labelFor(rows[0].period)} to ${labelFor(rows[rows.length - 1].period)}. ` +
      `Total disbursed ${formatCurrency(grand)}; highest month ${labelFor(peak.period)} at ${formatCurrency(peak.total)}.`
    );
  }, [rows]);

  const hasData = rows.some((row) => row.total > 0);

  return (
    <Card className="w-full rounded-xl border-border bg-card shadow-none">
      <CardHeader className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <CardTitle className="text-lg sm:text-xl">Loan Disbursements Over Time</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">Disbursement amounts by loan category per period</p>
        </div>
        <PeriodRangeFilter value={period} onChange={() => {}} className="pointer-events-none opacity-60" />
      </CardHeader>
      <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
        {isLoading ? (
          <Skeleton className="h-[260px] w-full sm:h-[330px] lg:h-[390px]" />
        ) : error ? (
          <p role="alert" className="py-16 text-center text-sm text-destructive">
            Could not load disbursements: {(error as Error).message}
          </p>
        ) : !hasData ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground sm:h-[330px] lg:h-[390px]">
            No disbursements in this period
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2 px-2 text-xs text-muted-foreground sm:px-0">
              <span aria-hidden className="inline-block h-0.5 w-5 rounded bg-chart-2" />
              <span>Total disbursed per month (hover for the category breakdown)</span>
            </div>
            <Chart
              definition={definition}
              height={330}
              ariaLabel={summary}
              ariaDescription="Hover or focus a point to see the amount per loan category for that month."
              style={chartHostStyle}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
