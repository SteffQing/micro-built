"use client";

import { icons } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";
import { useQuery } from "@tanstack/react-query";
import { loanReportOverview } from "@/lib/queries/admin/dashboard";
import { formatCurrency } from "@/lib/utils";
import ReportCard from "@/components/report-card";
import type { PeriodRangeValue } from "@/components/period-range-filter";

export function SectionCardsLoanManagement({ period }: { period: PeriodRangeValue }) {
  const range = period.from && period.to ? period : undefined;
  const { data } = useQuery(loanReportOverview(range));
  return (
    <div className="grid w-full grid-cols-1 gap-4 @md/main:grid-cols-2 @5xl/main:grid-cols-4">
      <ReportCard
        title="Total Loan Amount"
        value={formatCurrency(data?.data?.totalLoanAmount)}
        icon={<IconTile icon={icons.wallet} tone="brand" />}
      />
      <ReportCard
        title="Outstanding Amount"
        value={formatCurrency(data?.data?.outstanding)}
        icon={<IconTile icon={icons.calendarClock} tone="warning" />}
      />
      <ReportCard
        title="Amount Disbursed"
        value={formatCurrency(data?.data?.totalDisbursed)}
        icon={<IconTile icon={icons.moneyReceive} tone="brand" />}
      />
      <ReportCard
        title="Amount Repaid"
        value={formatCurrency(data?.data?.totalRepaid)}
        icon={<IconTile icon={icons.checkCircle} tone="success" />}
      />
      <ReportCard
        title="Interest Booked"
        value={formatCurrency(data?.data?.interestBooked)}
        icon={<IconTile icon={icons.percent} tone="brand" />}
      />
      <ReportCard
        title="Interest Collected"
        value={formatCurrency(data?.data?.interestCollected)}
        icon={<IconTile icon={icons.trendingUp} tone="success" />}
      />
      <ReportCard
        title="Active Loans"
        value={(data?.data?.activeLoansCount ?? 0).toString()}
        icon={<IconTile icon={icons.loans} tone="brand" />}
      />
      <ReportCard
        title="Pending Loans"
        value={(data?.data?.pendingLoansCount ?? 0).toString()}
        icon={<IconTile icon={icons.alert} tone="warning" />}
      />
    </div>
  );
}
