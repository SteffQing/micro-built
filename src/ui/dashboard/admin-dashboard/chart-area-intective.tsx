"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const timePeriods = [
  { value: "monthly", label: "Monthly" },
  { value: "bimonthly", label: "Two Months" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Two Weeks" },
];

const chartConfig = {
  total: {
    label: "Total",
    color: "hsl(142, 76%, 36%)",
  },
} satisfies ChartConfig;

export default function LoanDisbursementChart() {
  const [timePeriod, setTimePeriod] = useState("monthly");

  const data = chartData[timePeriod as keyof typeof chartData];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl">Loan Disbursements Overtime</CardTitle>
          {/* <CardDescription>{getTimeRangeTitle()}</CardDescription> */}
        </div>
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time period" />
          </SelectTrigger>
          <SelectContent>
            {timePeriods.map((period) => (
              <SelectItem key={period.value} value={period.value}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <LineChart
            accessibilityLayer
            data={data}
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

// Define chart data for different time periods
const chartData = {
  monthly: [
    { period: "Jan", total: 75000, mortgage: 30000, education: 25000, personal: 10000, others: 10000 },
    { period: "Feb", total: 280000, mortgage: 120000, education: 90000, personal: 40000, others: 30000 },
    { period: "Mar", total: 320000, mortgage: 140000, education: 100000, personal: 50000, others: 30000 },
    { period: "Apr", total: 210000, mortgage: 90000, education: 70000, personal: 30000, others: 20000 },
    { period: "May", total: 800000, mortgage: 330000, education: 300000, personal: 100000, others: 70000 },
    { period: "Jun", total: 620000, mortgage: 250000, education: 220000, personal: 80000, others: 70000 },
    { period: "Jul", total: 580000, mortgage: 230000, education: 200000, personal: 90000, others: 60000 },
    { period: "Aug", total: 650000, mortgage: 270000, education: 230000, personal: 80000, others: 70000 },
    { period: "Sep", total: 750000, mortgage: 310000, education: 260000, personal: 100000, others: 80000 },
    { period: "Oct", total: 430000, mortgage: 180000, education: 150000, personal: 60000, others: 40000 },
    { period: "Nov", total: 900000, mortgage: 380000, education: 320000, personal: 120000, others: 80000 },
    { period: "Dec", total: 750000, mortgage: 310000, education: 260000, personal: 100000, others: 80000 },
  ],
  bimonthly: [
    { period: "Jan-Feb", total: 355000, mortgage: 150000, education: 115000, personal: 50000, others: 40000 },
    { period: "Mar-Apr", total: 530000, mortgage: 230000, education: 170000, personal: 80000, others: 50000 },
    { period: "May-Jun", total: 1420000, mortgage: 580000, education: 520000, personal: 180000, others: 140000 },
    { period: "Jul-Aug", total: 1230000, mortgage: 500000, education: 430000, personal: 170000, others: 130000 },
    { period: "Sep-Oct", total: 1180000, mortgage: 490000, education: 410000, personal: 160000, others: 120000 },
    { period: "Nov-Dec", total: 1650000, mortgage: 690000, education: 580000, personal: 220000, others: 160000 },
  ],
  weekly: [
    { period: "Week 1", total: 180000, mortgage: 75000, education: 60000, personal: 25000, others: 20000 },
    { period: "Week 2", total: 210000, mortgage: 90000, education: 70000, personal: 30000, others: 20000 },
    { period: "Week 3", total: 250000, mortgage: 100000, education: 90000, personal: 35000, others: 25000 },
    { period: "Week 4", total: 320000, mortgage: 130000, education: 110000, personal: 45000, others: 35000 },
    { period: "Week 5", total: 280000, mortgage: 120000, education: 90000, personal: 40000, others: 30000 },
    { period: "Week 6", total: 350000, mortgage: 140000, education: 120000, personal: 50000, others: 40000 },
    { period: "Week 7", total: 420000, mortgage: 170000, education: 150000, personal: 60000, others: 40000 },
    { period: "Week 8", total: 380000, mortgage: 160000, education: 130000, personal: 50000, others: 40000 },
    { period: "Week 9", total: 450000, mortgage: 180000, education: 160000, personal: 65000, others: 45000 },
    { period: "Week 10", total: 520000, mortgage: 210000, education: 190000, personal: 70000, others: 50000 },
    { period: "Week 11", total: 480000, mortgage: 200000, education: 170000, personal: 65000, others: 45000 },
    { period: "Week 12", total: 550000, mortgage: 230000, education: 190000, personal: 75000, others: 55000 },
  ],
  biweekly: [
    { period: "Weeks 1-2", total: 390000, mortgage: 165000, education: 130000, personal: 55000, others: 40000 },
    { period: "Weeks 3-4", total: 570000, mortgage: 230000, education: 200000, personal: 80000, others: 60000 },
    { period: "Weeks 5-6", total: 630000, mortgage: 260000, education: 210000, personal: 90000, others: 70000 },
    { period: "Weeks 7-8", total: 800000, mortgage: 330000, education: 280000, personal: 110000, others: 80000 },
    { period: "Weeks 9-10", total: 970000, mortgage: 390000, education: 350000, personal: 135000, others: 95000 },
    { period: "Weeks 11-12", total: 1030000, mortgage: 430000, education: 360000, personal: 140000, others: 100000 },
  ],
}