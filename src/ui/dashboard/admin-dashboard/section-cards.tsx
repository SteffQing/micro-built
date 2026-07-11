"use client";

import { IconsIllustration } from "@/components/icons-illustrations";
import PeriodFilter from "@/components/period-filter";
import { overview } from "@/lib/queries/admin/dashboard";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

const card = "rounded-xl border border-[#eeeeee] bg-white";

function MetricCard({ icon, value, label, growth, href }: { icon: ReactNode; value: string; label: string; growth?: string; href?: string }) {
  return (
    <div className={`${card} flex min-h-36 flex-col justify-between p-4 sm:min-h-40 sm:p-5`}>
      <div className="flex items-start justify-between">
        <span>{icon}</span>
        {growth ? (
          <span className="flex items-center gap-1 rounded bg-[#effff3] px-2 py-1 text-xs font-medium text-[#00d83a]">
            {growth} <TrendingUp className="size-3" />
          </span>
        ) : href ? (
          <Link href={href} className="flex items-center text-xs text-[#999] hover:text-foreground">See all <ChevronRight className="size-4" /></Link>
        ) : null}
      </div>
      <div>
        <p className="text-[22px] font-semibold tabular-nums text-[#333]">{value}</p>
        <p className="mt-2 text-sm text-[#999]">{label}</p>
      </div>
    </div>
  );
}

function SplitMetric({ icon, title, leftLabel, leftValue, rightLabel, rightValue, danger = false }: { icon: ReactNode; title: string; leftLabel: string; leftValue: string; rightLabel: string; rightValue: string; danger?: boolean }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex min-h-[72px] items-center gap-3 border-b px-4 py-3 text-sm text-[#999] sm:h-[78px] sm:px-5">
        <span className={danger ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-[#9f0808] text-sm font-bold leading-none text-white" : ""}>{icon}</span>
        {title}
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:gap-4 sm:px-5">
        <div><p className="text-xs text-[#999]">{leftLabel}</p><p className="mt-2 text-sm font-semibold tabular-nums">{leftValue}</p></div>
        <div className="text-right"><p className="text-xs text-[#999]">{rightLabel}</p><p className="mt-2 text-sm font-semibold tabular-nums">{rightValue}</p></div>
      </div>
    </div>
  );
}

export function DashboardPeriodFilter({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return <PeriodFilter from={from} to={to} onChange={onChange} />;
}

export function SectionCardsAdminDashboad({ range }: { range: { from: string; to: string } }) {
  const { data } = useQuery(overview(range.from && range.to ? range : undefined));
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
        <SplitMetric icon={<IconsIllustration.naira />} title="Interests/Management Fees" leftLabel="Interest Booked" leftValue={money(stats?.interestEarned)} rightLabel="Management Fee" rightValue={money(stats?.totalMgtFee)} />
        <SplitMetric danger icon="!" title="Default Charges" leftLabel="Total" leftValue={money(stats?.penaltyCharged)} rightLabel="Received" rightValue={money(stats?.penaltyReceived)} />
        <div className="sm:col-span-2 lg:col-span-1"><MetricCard icon={<IconsIllustration.document />} value={(stats?.pendingCount ?? 0).toLocaleString()} label="Pending Loan Requests" href="/loans" /></div>
      </div>
    </section>
  );
}
