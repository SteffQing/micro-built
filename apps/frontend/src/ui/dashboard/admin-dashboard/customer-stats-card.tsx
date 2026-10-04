"use client";

import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { customersOverview } from "@/lib/queries/admin/dashboard";
import { useQuery } from "@tanstack/react-query";

export default function CustomerStatsCard() {
  const { data } = useQuery(customersOverview);

  return (
    <Card className="h-full w-full rounded-xl border-border bg-card shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-4 sm:p-6 sm:pb-4">
        <div>
          <div className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">{(data?.activeCustomersCount ?? 0).toLocaleString()} <Icon icon={icons.userGroup} size={20} className="fill-current" /></div>
          <CardTitle className="text-base font-normal text-muted-foreground mt-1">Total Active Customers</CardTitle>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          See all
          <Icon icon={icons.chevronRight} size={16} className="ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3 pr-3">
              <div className="h-3 w-3 rounded-full bg-success" />
              <span className="text-xs leading-5 text-muted-foreground">Customers with active loans</span>
            </div>
            <span className="text-xs font-medium">{data?.customersWithActiveLoansCount ?? 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3 pr-3">
              <div className="h-3 w-3 rounded-full bg-success" />
              <span className="text-xs leading-5 text-muted-foreground">Customers repaying <span className="text-success">on time</span></span>
            </div>
            <span className="text-xs font-medium">{data?.ontimeCount ?? 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3 pr-3">
              <div className="h-3 w-3 rounded-full bg-destructive" />
              <span className="text-xs leading-5 text-muted-foreground">Customers <span className="text-destructive">flagged</span> with issues</span>
            </div>
            <span className="text-xs font-medium">{data?.flaggedCount ?? 0}</span>
          </div>
          <div className="hidden items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full`} />
              <span className="text-sm text-muted-foreground">Customers with defaulted repayments</span>
            </div>
            <span className="text-sm font-medium">{data?.defaultedCount ?? 0}</span>
          </div>
          <div className="hidden items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full`} />
              <span className="text-sm text-muted-foreground">Customers with flagged repayments</span>
            </div>
            <span className="text-sm font-medium">{data?.flaggedCount ?? 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
