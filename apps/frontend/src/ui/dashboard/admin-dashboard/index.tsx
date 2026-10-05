"use client";

import { DashboardPeriodFilter, SectionCardsAdminDashboad } from "./section-cards";
import LoanDisbursementChart from "./chart-area-intective";
import LoanRequestTableAdminDashboard from "./loan-request-table";
import CustomerStatsCard from "./customer-stats-card";
import OperationsRail from "./operations-rail";
import RecentActivity from "./recent-activity";
import PageTitle from "@/components/page-title";
import RequestVariationSchedule from "@/ui/modals/request-variation";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PeriodRangeValue } from "@/components/period-range-filter";

type Props = {
  role: "ADMIN" | "SUPER_ADMIN";
};

export function AdminDashboardPage({ role }: Props) {
  const [period, setPeriod] = useState<PeriodRangeValue>({ from: "", to: "" });
  // Notification links land here with ?variation=open to show the monthly variation dialog.
  const openVariation = useSearchParams().has("variation");

  return (
    <div className="@container/main flex min-w-0 flex-col gap-4 bg-muted px-3 py-4 sm:px-4 md:gap-5 md:px-6 md:py-5">
      <PageTitle
        title="Dashboard"
        titleAside={<DashboardPeriodFilter value={period} onChange={setPeriod} />}
        actionContent={<RequestVariationSchedule role={role} defaultOpen={openVariation} />}
      />
      <OperationsRail />
      <SectionCardsAdminDashboad period={period} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2.35fr)_minmax(280px,1fr)]">
        <div className="min-w-0">
          <LoanDisbursementChart period={period} />
        </div>
        <div className="min-w-0">
          <CustomerStatsCard />
        </div>
      </div>

      <RecentActivity />
      <LoanRequestTableAdminDashboard />
    </div>
  );
}
