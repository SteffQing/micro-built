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

const grid = "grid gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-[1.7fr_1.3fr_1.2fr]";
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
  // Follows the ledger, not the calendar: an organization owes payroll a voucher only for a month whose variation was
  // generated, and has a variation to generate only while it has deductions waiting.
  const organizations = ops.organizations;
  const awaitingCount = organizations.filter((o) => o.awaitingVoucher.length > 0).length;
  const toGenerateCount = organizations.filter((o) => o.toGenerate).length;
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
      {/* Payroll by organization — each organization has its own variation and voucher; the brand edge marks it as the primary status */}
      <div className={cn(panel, "relative")}>
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />
        <PanelHeading
          icon={icons.calendarClock}
          aside={
            awaitingCount > 0 ? (
              <StatusPill tone="warning">
                {awaitingCount} awaiting {awaitingCount === 1 ? "voucher" : "vouchers"}
              </StatusPill>
            ) : toGenerateCount > 0 ? (
              <StatusPill tone="warning">{toGenerateCount} to generate</StatusPill>
            ) : (
              <StatusPill tone="success">Up to date</StatusPill>
            )
          }
        >
          Payroll by organization
        </PanelHeading>
        <div className="space-y-1">
          <p className="text-xl leading-tight font-semibold tracking-tight">
            {awaitingCount > 0
              ? `${awaitingCount} ${awaitingCount === 1 ? "organization is" : "organizations are"} waiting on payroll`
              : toGenerateCount > 0
                ? `${toGenerateCount} ${toGenerateCount === 1 ? "variation" : "variations"} to generate`
                : run
                  ? "Every variation is settled"
                  : "Nothing sent to payroll yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {run
              ? `Last voucher: ${run.organization} · ${titleCase(run.period)} · ${format(new Date(run.date), "d MMM yyyy")}`
              : "No voucher has been processed yet."}
          </p>
        </div>
        {organizations.length > 0 && (
          <ul className="-mx-2 grid max-h-44 gap-0.5 overflow-y-auto">
            {organizations.map((organization) => {
              const waiting = organization.awaitingVoucher;
              const focus = waiting[0] ?? organization.toGenerate ?? organization.latestLocked;
              return (
                <li key={organization.id}>
                  <Link
                    href={`/variations?organizationId=${organization.id}${focus ? `&period=${focus.ym}` : ""}`}
                    className="group flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">{organization.name}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                        waiting.length > 0
                          ? "bg-warning/12 text-warning"
                          : organization.toGenerate
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {waiting.length > 0
                        ? `Awaiting voucher · ${titleCase(waiting[0].label)}${waiting.length > 1 ? ` +${waiting.length - 1}` : ""}`
                        : organization.toGenerate
                          ? `Generate ${titleCase(organization.toGenerate.label)}`
                          : organization.latestLocked
                            ? `Locked ${titleCase(organization.latestLocked.label)}`
                            : "No variation yet"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Link
          href="/variations"
          className="mt-auto inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Open variations
          <Icon icon={icons.chevronRight} size={14} />
        </Link>
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
          {/* "Needs attention" next to an "All clear" badge contradicts itself; name the panel by its state. */}
          {totalAttention > 0 ? "Needs attention" : "Admin queues"}
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
