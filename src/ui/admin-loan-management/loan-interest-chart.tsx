"use client";

import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Sample data that matches the chart pattern
const monthlyData = [
  { month: "Jan", interests: 200000, management: 150000 },
  { month: "Feb", interests: 550000, management: 250000 },
  { month: "Mar", interests: 500000, management: 750000 },
  { month: "Apr", interests: 1200000, management: 650000 },
  { month: "May", interests: 750000, management: 550000 },
  { month: "Jun", interests: 700000, management: 350000 },
  { month: "Jul", interests: 450000, management: 100000 },
  { month: "Aug", interests: 950000, management: 200000 },
  { month: "Sep", interests: 550000, management: 750000 },
  { month: "Oct", interests: 700000, management: 1000000 },
  { month: "Nov", interests: 1300000, management: 750000 },
  { month: "Dec", interests: 1100000, management: 450000 },
];

const weeklyData = [
  { month: "Week 1", interests: 400000, management: 300000 },
  { month: "Week 2", interests: 600000, management: 450000 },
  { month: "Week 3", interests: 800000, management: 600000 },
  { month: "Week 4", interests: 500000, management: 400000 },
];

const yearlyData = [
  { month: "2020", interests: 2000000, management: 1500000 },
  { month: "2021", interests: 3500000, management: 2800000 },
  { month: "2022", interests: 4200000, management: 3200000 },
  { month: "2023", interests: 5800000, management: 4100000 },
  { month: "2024", interests: 7200000, management: 5500000 },
];

const formatYAxis = (value: number) => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(0)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return value.toString();
};

// const formatTooltipValue = (value: number) => {
//   return `₦${value.toLocaleString()}`;
// };

//ts-ignore
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    // Add other properties that might exist in your payload
    //ts-ignore
    [key: string]: any;
  }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    // Show the green card tooltip similar to your image
    const value = payload[0].value; // Get the first value (you can customize this logic)
    return (
      <div className="bg-green-700 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium relative">
        ₦{value.toLocaleString()}
        <div className="absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-green-700"></div>
      </div>
    );
  }
  return null;
};

export default function InterestsManagementChart() {
  const [timePeriod, setTimePeriod] = useState("Monthly");
  const [isOpen, setIsOpen] = useState(false);

  const timeOptions = ["Monthly", "Weekly", "Yearly"];

  const getCurrentData = () => {
    switch (timePeriod) {
      case "Weekly":
        return weeklyData;
      case "Yearly":
        return yearlyData;
      default:
        return monthlyData;
    }
  };

  return (
    <Card className="w-full col-span-5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold text-gray-900">
              Interests & Management Charges
            </CardTitle>
            <CardDescription className="mt-2">
              This chart shows interests and charges earned over a specific
              period of time
            </CardDescription>
          </div>

          {/* Time Period Selector */}
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">
                {timePeriod}
              </span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {timeOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setTimePeriod(option);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      timePeriod === option ? "bg-gray-50 font-medium" : ""
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Legend */}
        <div className="flex items-center gap-6 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-800 rounded-full"></div>
            <span className="text-sm text-gray-600">Interests</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <span className="text-sm text-gray-600">Management Charges</span>
          </div>
        </div>

        {/* Chart */}
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={getCurrentData()}
              margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                dy={10}
              />
              <YAxis
                tickFormatter={formatYAxis}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                domain={[0, "dataMax + 200000"]}
                ticks={[0, 250000, 500000, 750000, 1000000, 1250000, 1500000]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="interests"
                stroke="#166534"
                strokeWidth={2}
                dot={{ fill: "#166534", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "#166534" }}
              />
              <Line
                type="monotone"
                dataKey="management"
                stroke="#4ade80"
                strokeWidth={2}
                dot={{ fill: "#4ade80", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "#4ade80" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
