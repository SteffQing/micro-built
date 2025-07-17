"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TooltipProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { useQuery } from "@tanstack/react-query";
import { cn, formatCurrency } from "@/lib/utils";
import { format, parse } from "date-fns";
import { disbursementChart } from "@/lib/queries/admin/dashboard";

const chartConfig = {
  total: {
    label: "Total",
    color: "hsl(1, 92%, 28%)",
  },
} satisfies ChartConfig;

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => ({
  value: (currentYear - i).toString(),
  label: (currentYear - i).toString(),
}));

export default function LoanDisbursementChart() {
  const [selectedYear, setSelectedYear] = useState("2025");
  const { data } = useQuery({
    ...disbursementChart(selectedYear),
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data).map(([month, data]) => ({
      period: month,
      total: data.total,
      ...data.categories,
    }));
  }, [data]);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl">Loan Disbursements Overtime</CardTitle>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year.value} value={year.value}>
                {year.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: 20,
              right: 20,
              left: 20,
              bottom: 20,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="period"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <YAxis
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              width={60}
            />
            <ChartTooltip
              cursor={{ stroke: "#f0f0f0", strokeWidth: 1 }}
              content={<LoanDisbursementTooltip />}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="var(--color-total)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function LoanDisbursementTooltip({
  active,
  payload,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;
  const excludedKeys = ["period", "total"];
  const entries = Object.entries(data).filter(
    ([key, value]) => !excludedKeys.includes(key) && typeof value === "number"
  );

  return (
    <div className="rounded-lg border bg-background p-2 shadow-md">
      <div className="mb-2 font-medium">
        {format(parse(data.period, "MMM", new Date()), "MMMM")}
      </div>
      <div className="space-y-1">
        {entries.map(([cat, value], idx) => (
          <div className="flex items-center gap-2" key={cat}>
            <div
              className={cn(
                "h-3 w-3 rounded-full",
                idx === 0 ? "bg-[#8A0806]" : "bg-[#FFE1E0]"
              )}
            />
            <span className="text-[#999999] text-xs font-normal">{cat}</span>
            <span className="ml-auto font-semibold text-xs text-[#333333]">
              {formatCurrency(value as number)}
            </span>
          </div>
        ))}
        <div className="mt-2 border-t pt-1 flex items-center gap-2 font-medium">
          <span>Total</span>
          <span className="ml-auto font-semibold">
            {formatCurrency(data.total)}
          </span>
        </div>
      </div>
    </div>
  );
}
