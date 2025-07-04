"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Repayment success rate data based on screenshot
const repaymentData = [
  { name: "Successful Repayments", value: 50, color: "#22c55e" }, // Green
  { name: "Pending Repayments", value: 27, color: "#fde047" },    // Yellow
  { name: "Failed Repayments", value: 23, color: "#f87171" }      // Red
];

export function LoanOverviewPieChart() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Repayment Success Rate</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={repaymentData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={0}
                paddingAngle={0}
                startAngle={90}
                endAngle={-270}
              >
                {repaymentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 w-full space-y-2">
          {repaymentData.map((entry, index) => (
            <div key={`legend-${index}`} className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-muted-foreground">
                {entry.name}:
              </span>
              <span className="text-sm font-medium">{entry.value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
