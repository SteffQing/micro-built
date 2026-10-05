"use client";

import { dashboardOperations } from "@/lib/queries/admin/dashboard";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Icon, icons, type IconData } from "@/components/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import Link from "next/link";

const formatRate = (pct: number | null) => {
  if (pct === null || pct === undefined) return "—";
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
};

// The API sends periods as "OCTOBER 2026"; all caps reads as an alarm, so show "October 2026".
const titleCase = (label: string) =>
  label.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

function PanelHeading({
  icon,
  children,
  aside,
}: {
  icon: IconData;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon icon={icon} size={15} />
        </span>
        <h2 className="text-sm font-medium text-muted-foreground">{children}</h2>
      </div>
      {aside}
    </div>
  );
}

function StatusPill({ tone, children }: { tone: "success" | "warning"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "success" ? "bg-success/12 text-success" : "bg-warning/12 text-warning"
      )}
    >
      <span className="relative flex size-1.5">
        {tone === "warning" && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-60 motion-reduce:animate-none" />
        )}
        <span
          className={cn(
            "relative inline-flex size-1.5 rounded-full",
            tone === "success" ? "bg-success" : "bg-warning"
          )}
        />
      </span>
      {children}
    </span>
  );
}

function AttentionRow({ label, count, href }: { label: string; count: number; href: string }) {
  const open = count > 0;
  return (
    <Link
      href={href}
      className="group -mx-2 flex flex-1 items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {open ? (
          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-warning/15 px-1.5 text-[11px] font-semibold text-warning tabular-nums">
            {count}
          </span>
        ) : (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
            <Icon icon={icons.check} size={12} />
            <span className="sr-only">0</span>
          </span>
        )}
        <span className={cn("truncate text-sm", open ? "font-medium text-foreground" : "text-muted-foreground")}>
          {label}
        </span>
      </span>
      <Icon
        icon={icons.chevronRight}
        size={14}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

const grid = "grid gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-[1.1fr_1.6fr_1.2fr]";
const panel = "flex min-w-0 flex-col gap-4 bg-card p-5 sm:p-6";

export default function OperationsRail() {
  const { data, isLoading } = useQuery(dashboardOperations);
  const ops = data?.data;

  if (isLoading) {
    return (
      <div className={grid}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={panel}>
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    );
  }
  if (!ops) return null;

  const run = ops.lastRepaymentRun;
  const current = titleCase(ops.currentPeriod);
  const attention = [
    { label: "Repayments to resolve", count: ops.attention.manualResolutions, href: "/repayments" },
    { label: "Liquidations to review", count: ops.attention.pendingLiquidations, href: "/repayments" },
    { label: "Flagged customers", count: ops.attention.flaggedCustomers, href: "/customers?status=FLAGGED" },
    { label: "Tenure changes pending", count: ops.attention.pendingTenureChanges, href: "/loans/tenure-changes" },
  ];
  const totalAttention = attention.reduce((sum, a) => sum + a.count, 0);
  const rates = [
    { label: "Interest", value: ops.rates.interestRate },
    { label: "Default charge", value: ops.rates.penaltyRate },
    { label: "Mgt. fee", value: ops.rates.managementFeeRate },
    { label: "Max deduction", value: ops.rates.maxDeductionRate },
  ];

  return (
    <section aria-label="Operations overview" className={grid}>
      {/* Payroll run — the platform's one heartbeat job; the brand edge marks it as the primary status */}
      <div className={cn(panel, "relative")}>
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />
        <PanelHeading
          icon={icons.calendarClock}
          aside={
            run?.upToDate ? (
              <StatusPill tone="success">Up to date</StatusPill>
            ) : (
              <StatusPill tone="warning">Awaiting file</StatusPill>
            )
          }
        >
          Payroll run
        </PanelHeading>
        <div className="space-y-1">
          <p className="text-xl leading-tight font-semibold tracking-tight">
            {run?.upToDate ? `${titleCase(run.period)} processed` : `Waiting on ${current}`}
          </p>
          <p className="text-sm text-muted-foreground">
            {run
              ? `Last run: ${titleCase(run.period)} · ${format(new Date(run.date), "d MMM yyyy")}`
              : "No payroll has been processed yet."}
          </p>
        </div>
        {!run?.upToDate && (
          <Link
            href="/repayments"
            className="mt-auto inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Upload the {current} payroll
            <Icon icon={icons.chevronRight} size={14} />
          </Link>
        )}
      </div>

      {/* Current platform rates — a divided 2×2 grid that fills the panel instead of floating tiles */}
      <div className={panel}>
        <PanelHeading
          icon={icons.percent}
          aside={
            <Link
              href="/settings"
              className="rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Manage
            </Link>
          }
        >
          Current rates
        </PanelHeading>
        <dl className="grid flex-1 grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-4 lg:grid-cols-2 [&>div]:border-border [&>div:nth-child(odd)]:border-r sm:[&>div]:border-r sm:[&>div:last-child]:border-r-0 lg:[&>div:nth-child(even)]:border-r-0 [&>div:nth-child(-n+2)]:border-b sm:[&>div:nth-child(-n+2)]:border-b-0 lg:[&>div:nth-child(-n+2)]:border-b">
          {rates.map((rate) => (
            <div key={rate.label} className="flex flex-col-reverse justify-center gap-0.5 px-4 py-3">
              <dt className="text-xs text-muted-foreground">{rate.label}</dt>
              <dd className="text-2xl leading-tight font-semibold tracking-tight tabular-nums">
                {formatRate(rate.value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Work waiting on an admin — every queue is always listed; zero rows show a check */}
      <div className={cn(panel, "gap-3")}>
        <PanelHeading
          icon={icons.alert}
          aside={
            totalAttention > 0 ? (
              <span className="rounded-full bg-warning/12 px-2 py-0.5 text-xs font-medium text-warning tabular-nums">
                {totalAttention} open
              </span>
            ) : (
              <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">All clear</span>
            )
          }
        >
          Needs attention
        </PanelHeading>
        <div className="flex flex-1 flex-col justify-between">
          {attention.map((a) => (
            <AttentionRow key={a.label} {...a} />
          ))}
        </div>
      </div>
    </section>
  );
}
