"use client";
import { TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

// Type definitions
interface LoanDisbursementData {
  month: string;
  amount: number;
  percentage: number;
}

interface LoanStatusData {
  name: string;
  value: number;
  color: string;
}

interface LineChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    value?: number;
    payload?: LoanDisbursementData;
  }>;
  label?: string;
}

interface PieChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    value?: number;
    payload?: LoanStatusData;
  }>;
}

interface CustomLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}

// Data for loan disbursements over time
const loanDisbursementData: LoanDisbursementData[] = [
  { month: "Jan", amount: 150000, percentage: 10 },
  { month: "Feb", amount: 400000, percentage: 25 },
  { month: "Mar", amount: 350000, percentage: 30 },
  { month: "Apr", amount: 720000, percentage: 50 },
  { month: "May", amount: 1200000, percentage: 75 },
  { month: "Jun", amount: 550000, percentage: 35 },
  { month: "Jul", amount: 220000, percentage: 15 },
  { month: "Aug", amount: 800000, percentage: 52 },
  { month: "Sep", amount: 600000, percentage: 40 },
  { month: "Oct", amount: 1500000, percentage: 95 },
  { month: "Nov", amount: 850000, percentage: 55 },
  { month: "Dec", amount: 1100000, percentage: 70 },
];

// Data for loan status distribution
const loanStatusData: LoanStatusData[] = [
  { name: "Active Loans", value: 50, color: "#22c55e" },
  { name: "Closed Loans", value: 37.5, color: "#94a3b8" },
  { name: "Defaulted", value: 12.5, color: "#ef4444" },
];

const disbursementConfig = {
  amount: {
    label: "Amount",
    color: "#22c55e",
  },
} satisfies ChartConfig;

const statusConfig = {
  active: {
    label: "Active Loans",
    color: "#22c55e",
  },
  closed: {
    label: "Closed Loans",
    color: "#94a3b8",
  },
  defaulted: {
    label: "Defaulted",
    color: "#ef4444",
  },
} satisfies ChartConfig;

// Custom label component for the donut chart
const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}: CustomLabelProps): null => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return null; // We'll show labels in the legend instead
};

export default function DisbursementsChart() {
  return (
    <div className="grid grid-cols-7  gap-6 p-6">
      {/* Loan Disbursements Over Time Chart */}
      <Card className="col-span-5">
        <CardHeader>
          <CardTitle>Loan Disbursements Overtime</CardTitle>
          <CardDescription>
            This chart shows the disbursements of loans over a period of time
          </CardDescription>
        </CardHeader>
          <ChartContainer config={disbursementConfig}>
            <LineChart
              accessibilityLayer
              data={loanDisbursementData}
              margin={{
                left: 20,
                right: 20,
                top: 20,
                bottom: 20,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${value / 1000000}M`;
                  if (value >= 1000) return `${value / 1000}k`;
                  return value;
                }}
              />
              <ChartTooltip
                cursor={false}
                content={({
                  active,
                  payload,
                  label,
                }: LineChartTooltipProps) => {
                  if (
                    active &&
                    payload &&
                    payload.length &&
                    payload[0]?.value
                  ) {
                    return (
                      <div className="bg-white p-3 border rounded-lg shadow-lg">
                        <p className="font-medium">{label}</p>
                        <p className="text-green-600">
                          Amount: ${payload[0].value.toLocaleString()}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                dataKey="amount"
                type="monotone"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{
                  fill: "#22c55e",
                  strokeWidth: 2,
                  r: 4,
                }}
                activeDot={{
                  r: 6,
                  stroke: "#22c55e",
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ChartContainer>
      </Card>

      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Loan Status Distribution</CardTitle>
          <CardDescription>
            Current status breakdown of all loans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={statusConfig}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={loanStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={100}
                  innerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                  strokeWidth={0}
                >
                  {loanStatusData.map(
                    (entry: LoanStatusData, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    )
                  )}
                </Pie>
                <ChartTooltip
                  content={({ active, payload }: PieChartTooltipProps) => {
                    if (
                      active &&
                      payload &&
                      payload.length &&
                      payload[0]?.payload
                    ) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                          <p className="font-medium">{data.name}</p>
                          <p style={{ color: data.color }}>{data.value}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>

          {/* Legend for status distribution */}
          <div className="mt-4 space-y-2">
            {loanStatusData.map((item: LoanStatusData, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <span className="text-sm font-bold">{item.value}%</span>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="flex gap-2 leading-none font-medium">
            Active loans represent majority of portfolio
          </div>
          <div className="text-muted-foreground leading-none">
            Real-time loan status distribution overview
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
