"use client";

import { IconsIllustration } from "@/components/icons-illustrations";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { loanReportOverview } from "@/lib/queries/admin/dashboard";
import { formatCurrency } from "@/lib/utils";
import ReportCard from "@/components/report-card";
import PeriodRangeFilter, { type PeriodRangeValue } from "@/components/period-range-filter";

export function SectionCardsLoanManagement() {
  const [period, setPeriod] = useState<PeriodRangeValue>({ from: "", to: "" });
  const range = period.from && period.to ? period : undefined;
  const { data } = useQuery(loanReportOverview(range));
  return (
    <>
    <PeriodRangeFilter
      value={period}
      onChange={setPeriod}
    />
    <div className="grid grid-cols-1 gap-2 justify-between w-full *:data-[slot=card]:shadow-xs @xl/main:grid-cols-3 @5xl/main:grid-cols-5">
      <ReportCard
        title="Total Loan Amount"
        value={formatCurrency(data?.data?.totalLoanAmount)}
        icon={<IconsIllustration.earnings className="h-10" />}
      />
      <ReportCard
        title="Outstanding Amount"
        value={formatCurrency(data?.data?.outstanding)}
        icon={<IconsIllustration.money_out_icon className="h-10" />}
      />
      <ReportCard
        title="Amount Disbursed"
        value={formatCurrency(data?.data?.totalDisbursed)}
        icon={<IconsIllustration.money_out_icon className="h-10" />}
      />
      <ReportCard
        title="Amount Repaid"
        value={formatCurrency(data?.data?.totalRepaid)}
        icon={<IconsIllustration.alert_document className="h-10" />}
      />
      <ReportCard
        title="Interest Booked"
        value={formatCurrency(data?.data?.interestBooked)}
        icon={<IconsIllustration.earnings className="h-10" />}
      />
      <ReportCard
        title="Interest Collected"
        value={formatCurrency(data?.data?.interestCollected)}
        icon={<IconsIllustration.earnings className="h-10" />}
      />
      <ReportCard
        title="Active Loans"
        value={(data?.data?.activeLoansCount ?? 0).toString()}
        icon={<IconsIllustration.active_document className="h-10" />}
      />
      <ReportCard
        title="Pending Loans"
        value={(data?.data?.pendingLoansCount ?? 0).toString()}
        icon={<IconsIllustration.completed_document className="h-10" />}
      />
    </div>
    </>
  );
}
