"use client";

import { dashboardOperations } from "@/lib/queries/admin/dashboard";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import Link from "next/link";

const formatRate = (pct: number | null) => {
  if (pct === null || pct === undefined) return "—";
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-normal text-brand-foreground/90">
      {children}
    </p>
  );
}

function AttentionRow({
  label,
  count,
  href,
}: {
  label: string;
  count: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-sm"
    >
      <span className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
            count > 0 ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
        <span
          className={cn(
            "text-sm truncate",
            count > 0 ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
      </span>
      <Icon icon={icons.chevronRight} size={14} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function OperationsRail() {
  const { data, isLoading } = useQuery(dashboardOperations);
  const ops = data?.data;

  if (isLoading) {
    return (
      <div className="rounded-xl bg-brand p-5 animate-pulse">
        <div className="h-16 w-full rounded bg-brand-foreground/5" />
      </div>
    );
  }
  if (!ops) return null;

  const run = ops.lastRepaymentRun;

  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[1fr_2fr_1.35fr]">
      {/* Payroll run — the platform's one heartbeat job */}
      <div className="flex min-h-32 flex-col justify-between gap-3 bg-gradient-to-r from-brand/80 to-brand p-5 text-brand-foreground sm:p-6 lg:min-h-36 lg:border-r lg:border-dashed lg:border-border">
        <Eyebrow>Payroll run</Eyebrow>
        <div>
          <p className="text-base font-normal tabular-nums leading-tight">
            {run ? run.period : "None yet"}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {run?.upToDate ? (
              <>
                <span className="h-2 w-2 rounded-full bg-success shrink-0" />
                <p className="text-sm text-brand-foreground/70">
                  Deductions processed for this period
                </p>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
                </span>
                <p className="text-sm text-brand-foreground/70">
                  Awaiting the {ops.currentPeriod} payroll file
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Current platform rates */}
      <div className="flex min-h-32 flex-col justify-between gap-3 bg-gradient-to-r from-brand to-brand/70 p-5 text-brand-foreground sm:p-6 lg:min-h-36">
        <Eyebrow>Current rates</Eyebrow>
        <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-4">
          <div>
            <p className="text-base font-semibold tabular-nums">
              {formatRate(ops.rates.interestRate)}
            </p>
            <p className="mt-1 text-[11px] text-brand-foreground/50">Interest</p>
          </div>
          <div>
            <p className="text-base font-semibold tabular-nums">
              {formatRate(ops.rates.penaltyRate)}
            </p>
            <p className="mt-1 text-xs text-brand-foreground/80">Default Charge</p>
          </div>
          <div>
            <p className="text-base font-semibold tabular-nums">
              {formatRate(ops.rates.managementFeeRate)}
            </p>
            <p className="mt-1 text-xs text-brand-foreground/80">Mgt. Fee</p>
          </div>
          <div>
            <p className="text-base font-semibold tabular-nums">
              {formatRate(ops.rates.maxDeductionRate)}
            </p>
            <p className="mt-1 text-xs text-brand-foreground/80">Max Deduction</p>
          </div>
        </div>
      </div>

      {/* Work waiting on an admin */}
      <div className="flex min-h-32 flex-col gap-2 bg-card p-5 text-foreground lg:min-h-36">
        <p className="text-sm">Alerts</p>
        <div className="flex flex-col gap-1.5">
          <AttentionRow
            label="Repayments to resolve"
            count={ops.attention.manualResolutions}
            href="/repayments"
          />
          <AttentionRow
            label="Liquidations to review"
            count={ops.attention.pendingLiquidations}
            href="/repayments"
          />
          <AttentionRow
            label="Flagged customers"
            count={ops.attention.flaggedCustomers}
            href="/customers?status=FLAGGED"
          />
          <AttentionRow
            label="Tenure changes pending"
            count={ops.attention.pendingTenureChanges}
            href="/loans"
          />
        </div>
      </div>
    </div>
  );
}
