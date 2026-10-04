"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { disbursementChart } from "@/lib/queries/admin/dashboard";
import { parseYm, periodLabel } from "@microbuilt/shared";
import PeriodRangeFilter, { type PeriodRangeValue } from "@/components/period-range-filter";

const chartConfig = {
  total: {
    label: "Total",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

type Props = {
  period: PeriodRangeValue;
};

export default function LoanDisbursementChart({ period }: Props) {
  const range = period.from && period.to ? period : undefined;
  const { data } = useQuery(disbursementChart(range));

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((entry) => ({
      period: entry.period,
      total: entry.total,
      ...entry.categories,
    }));
  }, [data]);

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
        <ChartContainer config={chartConfig} className="h-[260px] w-full sm:h-[330px] lg:h-[390px]">
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: 20,
              right: 8,
              left: 0,
              bottom: 8,
            }}
          >
            <CartesianGrid vertical={false} horizontal={false} />
            <XAxis
              dataKey="period"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              tickFormatter={(v: string) => {
                try {
                  return periodLabel(parseYm(v));
                } catch {
                  return v;
                }
              }}
            />
            <YAxis
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              width={48}
            />
            <ChartTooltip cursor={{ stroke: "var(--border)", strokeWidth: 1 }} content={<LoanDisbursementTooltip />} />
            <Line
              type="monotone"
              dataKey="total"
              stroke="var(--color-total)"
              strokeWidth={1.5}
              dot={{ r: 4, fill: "var(--background)", stroke: "var(--color-total)", strokeWidth: 1.5 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function LoanDisbursementTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;
  const excludedKeys = ["period", "total"];
  const entries = Object.entries(data).filter(
    ([key, value]) => !excludedKeys.includes(key) && typeof value === "number"
  );

  const periodDisplay = (() => {
    try {
      return periodLabel(parseYm(data.period));
    } catch {
      return data.period;
    }
  })();

  return (
    <div className="rounded-lg border bg-background p-2 shadow-md">
      <div className="mb-2 font-medium">{periodDisplay}</div>
      <div className="space-y-1">
        {entries.map(([cat, value], idx) => (
          <div className="flex items-center gap-2" key={cat}>
            <div className={idx === 0 ? "h-3 w-3 rounded-full bg-primary" : "h-3 w-3 rounded-full bg-destructive/20"} />
            <span className="text-muted-foreground text-xs font-normal">{cat}</span>
            <span className="ml-auto font-semibold text-xs text-foreground">{formatCurrency(value as number)}</span>
          </div>
        ))}
        <div className="mt-2 border-t pt-1 flex items-center gap-2 font-medium">
          <span>Total</span>
          <span className="ml-auto font-semibold">{formatCurrency(data.total)}</span>
        </div>
      </div>
    </div>
  );
}
