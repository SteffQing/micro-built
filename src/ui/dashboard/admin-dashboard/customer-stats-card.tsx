"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const customerStats = [
  {
    label: "Customers with active loans",
    value: 850,
    color: "bg-black",
  },
  {
    label: "Customers repaying on time",
    value: 320,
    color: "bg-green-500",
  },
  {
    label: "Customers Flagged with issues",
    value: 75,
    color: "bg-red-500",
  },
];

export default function CustomerStatsCard() {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <div className="text-3xl font-bold">1,245</div>
          <CardTitle className="text-base font-normal text-muted-foreground mt-1">
            Total Active Customers
          </CardTitle>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          See all
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {customerStats.map((stat, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${stat.color}`} />
                <span className="text-sm text-muted-foreground">
                  {stat.label}
                </span>
              </div>
              <span className="text-sm font-medium">
                {stat.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
