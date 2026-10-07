"use client";

import { useQuery } from "@tanstack/react-query";
import { Icon, icons, type IconData } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";
import { customersOverview } from "@/lib/queries/admin/customers";
import ReportCard from "@/components/report-card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const share = (part: number, whole: number) => `${whole > 0 ? Math.round((part / whole) * 100) : 0}%`;

const metrics: {
  key: keyof CustomersOverviewDto;
  title: string;
  description: string;
  icon: IconData;
  tone: "brand" | "success" | "warning" | "danger" | "neutral";
  // Every card has a note, so they line up. flaggedCount (partial payers) is a subset of defaultedCount, so it
  // rides on that card instead of its own.
  note: (stats: CustomersOverviewDto) => string;
}[] = [
  {
    key: "activeCustomersCount",
    icon: icons.userGroup,
    tone: "brand",
    title: "Active",
    description: "Customers whose accounts are active.",
    note: () => "Accounts open for use",
  },
  {
    key: "flaggedCustomersCount",
    icon: icons.shieldAlert,
    tone: "warning",
    title: "Suspended",
    description:
      "Customers whose accounts are suspended for review or restricted. This is account status, not repayment behaviour.",
    note: () => "Account status, not repayments",
  },
  {
    key: "customersWithActiveLoansCount",
    icon: icons.wallet,
    tone: "brand",
    title: "With active loans",
    description:
      "Customers with at least one disbursed loan. Each customer is counted once, even with multiple loans.",
    note: (stats) => `${share(stats.customersWithActiveLoansCount, stats.activeCustomersCount)} of active customers`,
  },
  {
    key: "defaultedCount",
    icon: icons.alertTriangle,
    tone: "danger",
    title: "Defaulters",
    description:
      "Customers who did not clear the latest closed month in full, whether they paid nothing or fell short. They are counted here even if another repayment was paid in full.",
    note: (stats) => `${stats.flaggedCount.toLocaleString()} paid partially`,
  },
  {
    key: "ontimeCount",
    icon: icons.checkCircle,
    tone: "success",
    title: "Paying on time",
    description:
      "Customers with a repayment paid in full and no failed or partial repayments in the latest closed month.",
    note: (stats) => `${share(stats.ontimeCount, stats.customersWithActiveLoansCount)} of customers with loans`,
  },
];

export const AdminCustomerSectionCards = () => {
  const { data, isPending, isFetching, isError } =
    useQuery(customersOverview);
  const stats = data?.data;

  return (
    <section aria-label="Customer metrics" className="space-y-3">
      {isError && (
        <Alert variant="destructive">
          <Icon icon={icons.alert} size={16} />
          <AlertDescription>
            {stats
              ? "Could not update customer metrics. Showing the last loaded figures."
              : "Customer metrics could not be loaded. Reload the page to try again."}
          </AlertDescription>
        </Alert>
      )}

      <div
        className="grid w-full grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
        aria-busy={isFetching}
      >
        {metrics.map(({ key, title, description, icon, tone, note }) => (
          <ReportCard
            key={key}
            title={title}
            description={description}
            value={stats?.[key]?.toLocaleString() ?? "—"}
            icon={<IconTile icon={icon} tone={tone} />}
            className="rounded-xl"
            loading={isPending}
            note={stats ? note(stats) : undefined}
          />
        ))}
      </div>
    </section>
  );
};
