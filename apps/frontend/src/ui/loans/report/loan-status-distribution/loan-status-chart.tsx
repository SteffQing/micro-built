"use client";

import { useMemo } from "react";
import type { QueryObserverResult, RefetchOptions } from "@tanstack/react-query";
import { defineChart } from "@tanstack/charts";
import { pie, polar, radialArc } from "@tanstack/charts/polar";
import { Chart } from "@tanstack/charts/react";
import { tooltip } from "@tanstack/charts/tooltip";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon, icons } from "@/components/icon";
import { chartHostStyle, chartTheme, formatPercent } from "@/components/charts/theme";

interface LoanStatusChartProps {
  statusDistribution: LoanReportStatusDistributionDto;
  refetch: (options?: RefetchOptions) => Promise<QueryObserverResult<ApiRes<LoanReportStatusDistributionDto>, Error>>;
  isRefetching: boolean;
}

/** Lifecycle order, rejected last. Colours are theme tokens; the legend repeats every value as text. */
const STATUSES = [
  { status: "PENDING", label: "Pending", color: "var(--warning)" },
  { status: "APPROVED", label: "Approved", color: "var(--chart-2)" },
  { status: "DISBURSED", label: "Disbursed", color: "var(--primary)" },
  { status: "REPAID", label: "Repaid", color: "var(--success)" },
  { status: "REJECTED", label: "Rejected", color: "var(--destructive)" },
] as const satisfies ReadonlyArray<{ status: LoanStatus; label: string; color: string }>;

export function LoanStatusChart({ statusDistribution, refetch, isRefetching }: LoanStatusChartProps) {
  const { rows, total } = useMemo(() => {
    const counts = statusDistribution.statusCounts;
    const rows = STATUSES.map((s) => ({ status: s.status, label: s.label, color: s.color, count: counts[s.status] ?? 0 }));
    return { rows, total: rows.reduce((sum, r) => sum + r.count, 0) };
  }, [statusDistribution]);

  const definition = useMemo(() => {
    const slices = pie(
      rows.filter((r) => r.count > 0),
      { value: "count", gapAngle: 0.03 },
    );
    return defineChart(
      {
        marks: [
          polar({
            inset: 4,
            marks: [
              radialArc(slices, {
                innerRadius: ({ radius }) => radius * 0.66,
                cornerRadius: 3,
                color: "status",
                key: "status",
              }),
            ],
            scales: { angle: null, radius: null },
          }),
        ],
        scales: { x: null, y: null },
        color: { domain: rows.map((r) => r.status), range: rows.map((r) => r.color) },
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
                { label: "Loans", value: datum.count.toLocaleString() },
                { label: "Share", value: formatPercent(datum.fraction) },
              ],
            };
          },
        },
      },
    );
  }, [rows]);

  const summary =
    `Donut chart of ${total.toLocaleString()} loans by status: ` +
    rows.map((r) => `${r.label} ${r.count.toLocaleString()}`).join(", ") +
    ".";

  return (
    <Card className="h-full gap-4 rounded-xl border-border bg-card shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 sm:px-6">
        <CardTitle className="text-lg font-semibold">Loan Status Distribution</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Refresh loan status distribution"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <Icon icon={icons.refresh} size={16} className={isRefetching ? "animate-spin" : ""} />
        </Button>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <p className="text-sm">No loan data available</p>
            <p className="mt-1 text-xs">Check back when loans are created</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-8">
            <div className="relative w-full max-w-[220px] shrink-0">
              <Chart
                definition={definition}
                aspectRatio={1}
                initialWidth={220}
                ariaLabel={summary}
                style={chartHostStyle}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-sm text-muted-foreground">Total Loans</p>
                <p className="text-2xl font-bold">{total.toLocaleString()}</p>
              </div>
            </div>
            <ul className="w-full min-w-0 space-y-3 sm:max-w-xs">
              {rows.map((r) => (
                <li key={r.status} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="truncate text-sm text-muted-foreground">{r.label}</span>
                    <span className="text-xs text-muted-foreground">({r.count.toLocaleString()})</span>
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formatPercent(r.count / total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
