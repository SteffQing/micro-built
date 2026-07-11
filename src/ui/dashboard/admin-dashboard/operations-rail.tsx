"use client";

import { dashboardOperations } from "@/lib/queries/admin/dashboard";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

const formatRate = (fraction: number) => {
  const pct = fraction * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-normal text-white/90">
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
            count > 0 ? "bg-[#278b35] text-white" : "bg-[#f2f2f2] text-[#777]"
          )}
        >
          {count}
        </span>
        <span
          className={cn(
            "text-sm truncate",
            count > 0 ? "text-[#333]" : "text-[#aaa]"
          )}
        >
          {label}
        </span>
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#aaa] transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function OperationsRail() {
  const { data, isLoading } = useQuery(dashboardOperations);
  const ops = data?.data;

  if (isLoading) {
    return (
      <div className="rounded-xl bg-[#760807] p-5 animate-pulse">
        <div className="h-16 w-full rounded bg-white/5" />
      </div>
    );
  }
  if (!ops) return null;

  const run = ops.lastRepaymentRun;

  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-[#eeeeee] bg-white md:grid-cols-[1fr_2fr_1.35fr]">
      {/* Payroll run — the platform's one heartbeat job */}
      <div className="flex min-h-36 flex-col justify-between gap-3 bg-gradient-to-r from-[#450505] to-[#760807] p-6 text-white md:border-r md:border-dashed md:border-red-500">
        <Eyebrow>Payroll run</Eyebrow>
        <div>
          <p className="text-base font-normal tabular-nums leading-tight">
            {run ? run.period : "None yet"}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {run?.upToDate ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                <p className="text-sm text-white/70">
                  Deductions processed for this period
                </p>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                </span>
                <p className="text-sm text-white/70">
                  Awaiting the {ops.currentPeriod} payroll file
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Current platform rates */}
      <div className="flex min-h-36 flex-col justify-between gap-3 bg-gradient-to-r from-[#760807] to-[#af0d0d] p-6 text-white">
        <Eyebrow>Current rates</Eyebrow>
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-base font-semibold tabular-nums">
              {formatRate(ops.rates.interestRate)}
            </p>
            <p className="mt-1 text-[11px] text-white/50">Interest</p>
          </div>
          <div>
            <p className="text-base font-semibold tabular-nums">
              {formatRate(ops.rates.penaltyFeeRate)}
            </p>
            <p className="mt-1 text-xs text-white/80">Default Charge</p>
          </div>
          <div>
            <p className="text-base font-semibold tabular-nums">
              {formatRate(ops.rates.managementFeeRate)}
            </p>
            <p className="mt-1 text-xs text-white/80">Mgt. Fee</p>
          </div>
        </div>
      </div>

      {/* Work waiting on an admin */}
      <div className="flex min-h-36 flex-col gap-2 bg-white p-5 text-[#333]">
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
        </div>
      </div>
    </div>
  );
}
