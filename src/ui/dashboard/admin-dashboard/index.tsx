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

type Props = {
  role: "ADMIN" | "SUPER_ADMIN";
};

export function AdminDashboardPage({ role }: Props) {
  const [range, setRange] = useState({ from: "", to: "" });

  return (
    <div className="@container/main flex min-w-0 flex-col gap-4 bg-[#fafafa] px-3 py-4 sm:px-4 md:gap-5 md:px-6 md:py-5">
      <PageTitle title="Dashboard" actionContent={<div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"><DashboardPeriodFilter from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} /><RequestVariationSchedule role={role} /></div>} />
      <OperationsRail />
      <SectionCardsAdminDashboad range={range} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2.35fr)_minmax(280px,1fr)]">
        <div className="min-w-0">
          <LoanDisbursementChart />
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
