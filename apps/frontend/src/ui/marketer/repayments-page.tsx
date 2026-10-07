"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { icons } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";
import PageTitle from "@/components/page-title";
import ReportCard from "@/components/report-card";
import { marketerRepaymentOverview } from "@/lib/queries/marketer";
import { formatCurrency, formatPeriodLabel } from "@/lib/utils";
import { DeductionsTab } from "@/ui/repayments/admin-repayments-view/deductions-table";
import { MonthPicker } from "@/ui/variations/month-picker";

/**
 * How a marketer's customers repaid, one payroll month at a time: what payroll was asked to deduct, what came in, and
 * how each deduction ended. Opens on the latest month with deductions.
 */
export function MarketerRepaymentsPage() {
  const [picked, setPicked] = useState<string | null>(null);
  const { data, isLoading } = useQuery(marketerRepaymentOverview(picked ?? undefined));
  const overview = data?.data;
  const period = picked ?? overview?.period.ym ?? null;
  const counts = overview?.counts;
  const label = overview ? formatPeriodLabel(overview.period.label) : "";

  const cards = [
    {
      title: "Expected",
      icon: icons.calendar,
      tone: "brand" as const,
      value: formatCurrency(overview?.expected ?? 0),
      description: `What payroll was asked to deduct from your customers in ${label || "the month"}.`,
    },
    {
      title: "Collected",
      icon: icons.moneyReceive,
      tone: "success" as const,
      value: formatCurrency(overview?.collected ?? 0),
      description: "What came in against those deductions.",
    },
    {
      title: "Paid in full",
      icon: icons.checkCircle,
      tone: "success" as const,
      value: (counts?.FULFILLED ?? 0).toLocaleString(),
      description: "Deductions paid in full.",
    },
    {
      title: "Underpaid",
      icon: icons.alertTriangle,
      tone: "warning" as const,
      value: (counts?.PARTIAL ?? 0).toLocaleString(),
      description: "Deductions paid only in part.",
    },
    {
      title: "Not paid",
      icon: icons.shieldAlert,
      tone: "danger" as const,
      value: (counts?.FAILED ?? 0).toLocaleString(),
      description: "Deductions nothing came in for.",
    },
  ];

  return (
    <main className="space-y-3 p-3 lg:space-y-5 lg:p-5">
      <PageTitle
        title="Repayments"
        actionContent={
          period ? <MonthPicker value={period} onChange={setPicked} monthsAhead={0} className="h-9" /> : undefined
        }
      />
      <section
        aria-label={`Repayments in ${label}`}
        aria-busy={isLoading}
        className="grid w-full grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
      >
        {cards.map(({ title, icon, tone, value, description }) => (
          <ReportCard
            key={title}
            title={title}
            value={value}
            icon={<IconTile icon={icon} tone={tone} />}
            className="rounded-xl"
            loading={isLoading}
            description={description}
          />
        ))}
      </section>
      {period && <DeductionsTab marketer period={{ from: period, to: period }} />}
    </main>
  );
}
