"use client";

import { useState } from "react";
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
import {
  adminDisbursementChartOption,
  AdminDisbursementData,
} from "@/lib/queries/admin-disbursement-chart";

const chartConfig = {
  total: {
    label: "Total",
    color: "hsl(142, 76%, 36%)",
  },
} satisfies ChartConfig;

interface ProcessedChartData {
  period: string;
  total: number;
  [key: string]: number | string;
}

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => ({
  value: (currentYear - i).toString(),
  label: (currentYear - i).toString(),
}));

export default function LoanDisbursementChart() {
  const [selectedYear, setSelectedYear] = useState("2025");
  const { data } = useQuery({
    ...adminDisbursementChartOption({ year: selectedYear }),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const processChartData = (
    rawData: AdminDisbursementData[]
  ): ProcessedChartData[] => {
    if (!rawData) return [];

    return rawData.map((item) => {
      const total = Object.entries(item)
        .filter(([key]) => key !== "month")
        .reduce((sum, [, value]) => sum + (value as number), 0);

      return {
        period: item.month,
        total,
        EDUCATION: item.EDUCATION,
        PERSONAL: item.PERSONAL,
        BUSINESS: item.BUSINESS,
        MEDICAL: item.MEDICAL,
        RENT: item.RENT,
        TRAVEL: item.TRAVEL,
        AGRICULTURE: item.AGRICULTURE,
        UTILITIES: item.UTILITIES,
        EMERGENCY: item.EMERGENCY,
        OTHERS: item.OTHERS,
        ASSET_PURCHASE: item.ASSET_PURCHASE,
      };
    });
  };

  const chartData = processChartData(data?.data || []);

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
              content={
                <LoanDisbursementTooltip formatCurrency={formatCurrency} />
              }
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

interface LoanDisbursementTooltipProps
  extends TooltipProps<ValueType, NameType> {
  formatCurrency: (value: number) => string;
}

export function LoanDisbursementTooltip({
  active,
  payload,
  formatCurrency,
}: LoanDisbursementTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-background p-2 shadow-md">
      <div className="mb-2 font-medium">{data.period}</div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#22c55e]" />
          <span>Mortgage</span>
          <span className="ml-auto font-medium text-[#22c55e]">
            {formatCurrency(data.mortgage)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#86efac]" />
          <span>Education</span>
          <span className="ml-auto font-medium text-[#86efac]">
            {formatCurrency(data.education)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#bbf7d0]" />
          <span>Personal Loan</span>
          <span className="ml-auto font-medium text-[#bbf7d0]">
            {formatCurrency(data.personal)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#4ade80]" />
          <span>Others</span>
          <span className="ml-auto font-medium text-[#4ade80]">
            {formatCurrency(data.others)}
          </span>
        </div>
        <div className="mt-2 border-t pt-1 flex items-center gap-2 font-medium">
          <span>Total</span>
          <span className="ml-auto">{formatCurrency(data.total)}</span>
        </div>
      </div>
    </div>
  );
}
