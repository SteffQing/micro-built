"use client";

import { useQuery } from "@tanstack/react-query";
import { Icon, icons, type IconData } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";
import { customersOverview } from "@/lib/queries/admin/customers";
import ReportCard from "@/components/report-card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const metrics: {
  key: keyof CustomersOverviewDto;
  title: string;
  description: string;
  icon: IconData;
  tone: "brand" | "success" | "warning" | "danger" | "neutral";
}[] = [
  {
    key: "activeCustomersCount",
    icon: icons.userGroup,
    tone: "brand",
    title: "Active",
    description: "Customers whose accounts are active.",
  },
  {
    key: "flaggedCustomersCount",
    icon: icons.shieldAlert,
    tone: "warning",
    title: "Suspended",
    description:
      "Customers whose accounts are suspended for review or restricted. This is account status, not repayment behaviour.",
  },
  {
    key: "customersWithActiveLoansCount",
    icon: icons.wallet,
    tone: "brand",
    title: "With active loans",
    description:
      "Customers with at least one disbursed loan. Each customer is counted once, even with multiple loans.",
  },
  {
    key: "defaultedCount",
    icon: icons.alertTriangle,
    tone: "danger",
    title: "Defaulters",
    description:
      "Customers who did not clear the latest closed month in full, whether they paid nothing or fell short. They are counted here even if another repayment was paid in full.",
  },
  {
    key: "ontimeCount",
    icon: icons.checkCircle,
    tone: "success",
    title: "Paying on time",
    description:
      "Customers with a repayment paid in full and no failed or partial repayments in the latest closed month.",
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
          <Icon
            icon={icons.refresh}
            size={16}
            className={cn(isFetching && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      {isError && (
        <Alert variant="destructive">
          <Icon icon={icons.alert} size={16} />
          <AlertDescription>
            {stats
              ? "Could not refresh customer metrics. Showing the last loaded figures. Please try refreshing."
              : "Customer metrics could not be loaded. Please try refreshing."}
          </AlertDescription>
        </Alert>
      )}

      <div
        className="grid w-full grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
        aria-busy={isFetching}
      >
        {metrics.map(({ key, title, description, icon, tone }) => (
          <ReportCard
            key={key}
            title={title}
            description={description}
            value={stats?.[key]?.toLocaleString() ?? "—"}
            icon={<IconTile icon={icon} tone={tone} />}
            className="rounded-xl"
            loading={isPending}
          />
        ))}
      </div>
    </section>
  );
};
