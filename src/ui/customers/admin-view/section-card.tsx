"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import { customersOverview } from "@/lib/queries/admin/customers";
import ReportCard from "@/components/report-card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const metrics: {
  key: keyof CustomersOverviewDto;
  title: string;
  description: string;
}[] = [
  {
    key: "activeCustomersCount",
    title: "Active Customers",
    description: "Customers whose accounts are active.",
  },
  {
    key: "flaggedCustomersCount",
    title: "Suspended Customers",
    description:
      "Customers whose accounts are suspended for review or restricted. This is account status, not repayment behaviour.",
  },
  {
    key: "customersWithActiveLoansCount",
    title: "Customers with Active Loans",
    description:
      "Customers with at least one disbursed loan. Each customer is counted once, even with multiple loans.",
  },
  {
    key: "defaultedCount",
    title: "Defaulters",
    description:
      "Customers with a failed repayment in the latest closed month. They are counted here even if another repayment was partial or paid in full.",
  },
  {
    key: "ontimeCount",
    title: "Repaying on time",
    description:
      "Customers with a repayment paid in full and no failed or partial repayments in the latest closed month.",
  },
  {
    key: "flaggedCount",
    title: "Partial Repayments",
    description:
      "Customers who paid part of what was due, with no failed repayment, in the latest closed month. Account suspensions are counted separately.",
  },
];

export const AdminCustomerSectionCards = () => {
  const { data, isPending, isFetching, isError, refetch } =
    useQuery(customersOverview);
  const stats = data?.data;

  return (
    <section aria-label="Customer metrics" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-muted-foreground">
          Repayment metrics cover the latest closed repayment month. Each
          customer is counted once.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Refresh customer metrics"
        >
          <RefreshCw
            className={cn("size-4", isFetching && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {stats
              ? "Could not refresh customer metrics. Showing the last loaded figures. Please try refreshing."
              : "Customer metrics could not be loaded. Please try refreshing."}
          </AlertDescription>
        </Alert>
      )}

      <div
        className="grid w-full grid-cols-2 gap-2 *:data-[slot=card]:shadow-xs md:grid-cols-3 xl:grid-cols-6"
        aria-busy={isFetching}
      >
        {metrics.map(({ key, title, description }) => (
          <ReportCard
            key={key}
            title={title}
            description={description}
            value={stats?.[key]?.toLocaleString() ?? "—"}
            icon={
              <div className="absolute bottom-0 right-0 h-12 w-12 rounded-tl-full bg-secondary opacity-80" />
            }
            className="border-2 border-secondary"
            loading={isPending}
          />
        ))}
      </div>
    </section>
  );
};
