"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { userRepaymentsHistoryQueryForChartsOptions } from "@/lib/queries/user-repayments-chart";

const chartConfig = {
  repaid: {
    label: "Amount Repaid",
    color: "hsl(var(--destructive))",
  },
};

export function RepaymentChart() {
  // const [selectedYear, setSelectedYear] = useState(2025);
  const [viewType, setViewType] = useState<"Monthly" | "Quarterly" | "Yearly">(
    "Monthly"
  );

  const { data, isLoading, } = useQuery({
    ...userRepaymentsHistoryQueryForChartsOptions(),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatYAxisTick = (value: number) => {
    if (value >= 1000000) {
      return `${value / 1000000}M`;
    } else if (value >= 1000) {
      return `${value / 1000}k`;
    }
    return value.toString();
  };

  const chartData =
    data?.data?.map((item) => ({
      month: item.month.slice(0, 3),
      repaid: item.repaid,
    })) || [];

  return (
    <Card className="w-full col-span-3 bg-background">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-medium">Visual Chart</CardTitle>
        <div className="flex items-center gap-2">
          {(["Monthly", "Quarterly", "Yearly"] as const).map((type) => (
            <Button
              key={type}
              variant={viewType === type ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewType(type)}
              className={viewType === type ? "" : "text-muted-foreground"}
            >
              {type}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground">Loading chart data...</div>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#666" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#666" }}
                  tickFormatter={formatYAxisTick}
                />
                <ChartTooltip
                  content={({ active, payload, }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-red-600 text-white px-3 py-2 rounded-md shadow-lg">
                          <p className="font-medium">
                            {formatCurrency(payload[0].value as number)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="repaid"
                  stroke="var(--color-repaid)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-repaid)", strokeWidth: 2, r: 4 }}
                  activeDot={{
                    r: 6,
                    stroke: "var(--color-repaid)",
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
