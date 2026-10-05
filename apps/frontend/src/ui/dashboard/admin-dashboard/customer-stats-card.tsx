"use client";

import { Icon, icons } from "@/components/icon";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { customersOverview, statusDistribution } from "@/lib/queries/admin/dashboard";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function HealthRow({ label, count, total, tone }: { label: string; count: number; total: number; tone: string }) {
  const pct = share(count, total);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">
          {count.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">· {pct}%</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
        <div className={cn("h-full rounded-full transition-[width]", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Pipeline order follows a loan's life; colours are semantic tokens so both themes stay legible.
const pipeline: { status: LoanStatus; label: string; tone: string }[] = [
  { status: "PENDING", label: "Pending", tone: "bg-warning" },
  { status: "APPROVED", label: "Approved", tone: "bg-chart-2" },
  { status: "DISBURSED", label: "Disbursed", tone: "bg-primary" },
  { status: "REPAID", label: "Repaid", tone: "bg-success" },
  { status: "REJECTED", label: "Rejected", tone: "bg-muted-foreground" },
];

export default function CustomerStatsCard() {
  const { data, isLoading } = useQuery(customersOverview);
  const { data: distribution } = useQuery(statusDistribution);
  const counts = distribution?.data?.statusCounts;
  const active = data?.activeCustomersCount ?? 0;
  const loanTotal = counts ? pipeline.reduce((sum, p) => sum + (counts[p.status] ?? 0), 0) : 0;

  return (
    <Card className="h-full w-full gap-0 rounded-xl border-border bg-card py-0 shadow-none">
      <div className="flex items-start justify-between gap-3 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon icon={icons.userGroup} size={20} />
          </span>
          <div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl leading-none font-semibold tabular-nums sm:text-3xl">{active.toLocaleString()}</p>
            )}
            <h2 className="mt-1 text-sm text-muted-foreground">Active customers</h2>
          </div>
        </div>
        <Link
          href="/customers"
          className="flex items-center rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          See all <Icon icon={icons.chevronRight} size={16} />
        </Link>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-6 border-t p-4 sm:p-6">
        <section aria-label="Customer health" className="space-y-4">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Customer health</h3>
          <HealthRow label="With active loans" count={data?.customersWithActiveLoansCount ?? 0} total={active} tone="bg-primary" />
          <HealthRow label="Repaying on time" count={data?.ontimeCount ?? 0} total={active} tone="bg-success" />
          <HealthRow label="Flagged with issues" count={data?.flaggedCount ?? 0} total={active} tone="bg-destructive" />
        </section>

        <section aria-label="Loan pipeline" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Loan pipeline</h3>
            <span className="text-xs text-muted-foreground tabular-nums">{loanTotal.toLocaleString()} loans</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="presentation">
            {loanTotal > 0 &&
              pipeline.map((p) => {
                const n = counts?.[p.status] ?? 0;
                return n > 0 ? <div key={p.status} className={p.tone} style={{ width: `${share(n, loanTotal)}%` }} /> : null;
              })}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {pipeline.map((p) => (
              <div key={p.status} className="flex items-center justify-between gap-2 text-sm">
                <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <span className={cn("size-2 shrink-0 rounded-full", p.tone)} />
                  <span className="truncate">{p.label}</span>
                </dt>
                <dd className="font-medium tabular-nums">{(counts?.[p.status] ?? 0).toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </Card>
  );
}
