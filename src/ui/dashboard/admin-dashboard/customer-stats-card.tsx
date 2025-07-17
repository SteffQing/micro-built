"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { customersOverview } from "@/lib/queries/admin/dashboard";
import { useQuery } from "@tanstack/react-query";

export default function CustomerStatsCard() {
  const { data } = useQuery({
    ...customersOverview,
  });

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <div className="text-3xl font-bold">
            {data?.activeCustomersCount ?? 0}
          </div>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full`} />
              <span className="text-sm text-muted-foreground">
                Flagged Customers
              </span>
            </div>
            <span className="text-sm font-medium">
              {data?.flaggedCount ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full`} />
              <span className="text-sm text-muted-foreground">
                Customers with active loans
              </span>
            </div>
            <span className="text-sm font-medium">
              {data?.customersWithActiveLoansCount ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full`} />
              <span className="text-sm text-muted-foreground">
                Customers repaying on time
              </span>
            </div>
            <span className="text-sm font-medium">
              {data?.ontimeCount ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full`} />
              <span className="text-sm text-muted-foreground">
                Customers with defaulted repayments
              </span>
            </div>
            <span className="text-sm font-medium">
              {data?.defaultedCount ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full`} />
              <span className="text-sm text-muted-foreground">
                Customers with flagged repayments
              </span>
            </div>
            <span className="text-sm font-medium">
              {data?.flaggedCount ?? 0}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
