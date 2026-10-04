"use client";

import { IconsIllustration } from "@/components/icons-illustrations";
import PeriodRangeFilter from "@/components/period-range-filter";
import { overview } from "@/lib/queries/admin/dashboard";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import Link from "next/link";
import { type ReactNode } from "react";
import type { PeriodRangeValue } from "@/components/period-range-filter";

const card = "rounded-xl border border-border bg-card";

function MetricCard({ icon, value, label, growth, href }: { icon: ReactNode; value: string; label: string; growth?: string; href?: string; description?: string }) {
  return (
    <div className={`${card} flex min-h-36 flex-col justify-between p-4 sm:min-h-40 sm:p-5`}>
      <div className="flex items-start justify-between">
        <span>{icon}</span>
        {growth ? (
          <span className="flex items-center gap-1 rounded bg-success/10 px-2 py-1 text-xs font-medium text-success">
            {growth} <Icon icon={icons.trendingUp} size={12} />
          </span>
        ) : href ? (
          <Link href={href} className="flex items-center text-xs text-muted-foreground hover:text-foreground">See all <Icon icon={icons.chevronRight} size={16} /></Link>
        ) : null}
      </div>
      <div>
        <p className="text-[22px] font-semibold tabular-nums text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function SplitMetric({ icon, title, leftLabel, leftValue, rightLabel, rightValue, danger = false }: { icon: ReactNode; title: string; leftLabel: string; leftValue: string; rightLabel: string; rightValue: string; danger?: boolean }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex min-h-[72px] items-center gap-3 border-b px-4 py-3 text-sm text-muted-foreground sm:h-[78px] sm:px-5">
        <span className={danger ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold leading-none text-brand-foreground" : ""}>{icon}</span>
        {title}
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:gap-4 sm:px-5">
        <div><p className="text-xs text-muted-foreground">{leftLabel}</p><p className="mt-2 text-sm font-semibold tabular-nums">{leftValue}</p></div>
        <div className="text-right"><p className="text-xs text-muted-foreground">{rightLabel}</p><p className="mt-2 text-sm font-semibold tabular-nums">{rightValue}</p></div>
      </div>
    </div>
  );
}

export function DashboardPeriodFilter({ value, onChange }: { value: PeriodRangeValue; onChange: (value: PeriodRangeValue) => void }) {
  return <PeriodRangeFilter value={value} onChange={onChange} />;
}

export function SectionCardsAdminDashboad({ period }: { period: PeriodRangeValue }) {
  const range = period.from && period.to ? period : undefined;
  const { data } = useQuery(overview(range));
  const stats = data?.data;
  const money = (value?: number) => formatCurrency(value ?? 0);

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-4">
        <MetricCard icon={<IconsIllustration.contracts_list />} value={(stats?.activeCount ?? 0).toLocaleString()} label="Total Active Loans" href="/loans" />
        <MetricCard icon={<IconsIllustration.naira />} value={money(stats?.totalLoanAmount)} label="Total Loan Amount" />
        <MetricCard icon={<IconsIllustration.database />} value={money(stats?.totalDisbursed)} label="Total Amount Disbursed" />
        <MetricCard icon={<IconsIllustration.naira />} value={money(stats?.grossProfit)} label="Gross Profit" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-[1fr_1fr_0.65fr]">
        <SplitMetric
          icon={<IconsIllustration.naira />}
          title="Interest / Management Fee"
          leftLabel="Interest booked"
          leftValue={money(stats?.interestBooked)}
          rightLabel="Management fee"
          rightValue={money(stats?.managementFee)}
        />
        <SplitMetric
          danger
          icon="!"
          title="Default Charges"
          leftLabel="Charged"
          leftValue={money(stats?.penaltyCharged)}
          rightLabel="Collected"
          rightValue={money(stats?.penaltyCollected)}
        />
        <div className="sm:col-span-2 lg:col-span-1">
          <MetricCard
            icon={<IconsIllustration.naira />}
            value={money(stats?.outstanding)}
            label="Outstanding (all time)"
            description="Total outstanding balance across all active loans, regardless of period filter"
          />
        </div>
      </div>
    </section>
  );
}
