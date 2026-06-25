"use client";

import { IconsIllustration } from "@/components/icons-illustrations";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { overview } from "@/lib/queries/admin/dashboard";
import { formatCurrency } from "@/lib/utils";
import ReportCard from "@/components/report-card";
import PeriodFilter from "@/components/period-filter";

export function SectionCardsAdminDashboad() {
  const [range, setRange] = useState({ from: "", to: "" });
  const period = range.from && range.to ? range : undefined;
  const { data } = useQuery(overview(period));

  const {
    activeCount,
    pendingCount,
    grossProfit,
    totalDisbursed,
    totalLoanAmount,
    totalMgtFee,
    interestEarned,
    penaltyCharged,
    penaltyReceived,
  } = data?.data || {};

  return (
    <>
    <PeriodFilter
      from={range.from}
      to={range.to}
      onChange={(from, to) => setRange({ from, to })}
    />
    <div className="grid grid-cols-1 gap-2 justify-between w-full *:data-[slot=card]:shadow-xs @xl/main:grid-cols-4 @5xl/main:grid-cols-6">
      <ReportCard
        title="Total active loans"
        icon={<IconsIllustration.contracts_list />}
        value={(activeCount || 0).toString()}
      />
      <ReportCard
        title="Total Loan Amount"
        icon={<IconsIllustration.naira />}
        value={formatCurrency(totalLoanAmount || 0)}
      />
      <ReportCard
        title="Total Amount Disbursed"
        icon={<IconsIllustration.database />}
        value={formatCurrency(totalDisbursed || 0)}
      />
      <ReportCard
        title="Interest Booked"
        icon={<IconsIllustration.naira />}
        value={formatCurrency(interestEarned || 0)}
      />
      <ReportCard
        title="Total Management Fee"
        icon={<IconsIllustration.naira />}
        value={formatCurrency(totalMgtFee || 0)}
      />
      <ReportCard
        title="Gross Profit"
        icon={<IconsIllustration.naira />}
        value={formatCurrency(grossProfit || 0)}
      />
      <ReportCard
        title="Total Default Charges"
        icon={<IconsIllustration.naira />}
        value={formatCurrency(penaltyCharged || 0)}
      />
      <ReportCard
        title="Default Charges Received"
        icon={<IconsIllustration.naira />}
        value={formatCurrency(penaltyReceived || 0)}
      />
      <ReportCard
        title="Pending Loans"
        icon={<IconsIllustration.document />}
        value={(pendingCount || 0).toString()}
      />
    </div>
    </>
  );
}
