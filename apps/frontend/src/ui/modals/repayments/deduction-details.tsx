"use client";

import { useState, type JSX, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Icon, icons } from "@/components/icon";
import { getDeductionStatusBadge, getInflowSourceBadge } from "@/config/status";
import { deductionInfo } from "@/lib/queries/admin/repayment";
import { formatCurrency, formatPeriodLabel } from "@/lib/utils";
import { StatusPill, formatDate } from "@/ui/repayments/admin-repayments-view/paged-table-card";
import { RepaymentDetailsModal } from "./repayment-breakdown";

const STATUS_NOTE: Record<DeductionStatus, string> = {
  OPEN: "Still being worked out: the amount follows every payment, top-up and tenure change until this month is sent to payroll.",
  AWAITING: "Sent to payroll; the amount is fixed and waits for the month's payroll file.",
  FULFILLED: "Paid in full.",
  PARTIAL: "Payroll paid part of it; the shortfall stays on the loan.",
  FAILED: "Nothing came in for this month.",
};

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

/** One line of the calculation: label, the figure, and an optional operator in front of it. */
function Step({ label, value, op, strong }: { label: ReactNode; value: string; op?: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 text-sm ${strong ? "border-t border-border pt-2.5 font-semibold" : ""}`}>
      <span className="min-w-0 text-muted-foreground">
        {op && <span className="mr-1.5 inline-block w-3 text-center text-foreground">{op}</span>}
        {label}
      </span>
      <span className="shrink-0 tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function Calculation({ calc, expected }: { calc: NonNullable<DeductionDetailDto["calculation"]>; expected: number }) {
  if (calc.stopped) {
    return <p className="text-sm text-muted-foreground">The loan is no longer running, so payroll is told to stop (₦0).</p>;
  }
  const lastMonth = calc.remainingMonths <= 1;
  return (
    <div className="rounded-lg border border-border px-3 py-1">
      <Step label="Owed on the loan" value={formatCurrency(calc.owed)} />
      <Step op="−" label="Repaid so far" value={formatCurrency(calc.repaid)} />
      <Step op="−" label="Already sent to payroll" value={formatCurrency(calc.committed)} />
      <Step label="Left to spread" value={formatCurrency(calc.toSpread)} strong />
      <Step
        op="÷"
        label={
          <>
            Months left{" "}
            <span className="text-xs">
              ({calc.tenure} tenure − {calc.monthsSent} sent)
            </span>
          </>
        }
        value={String(calc.remainingMonths)}
      />
      <Step label={lastMonth ? "This month (the whole remainder)" : "This month"} value={formatCurrency(calc.amount)} strong />
      {Math.abs(calc.amount - expected) >= 0.01 && (
        <p className="pb-2 text-xs text-warning">
          The stored amount ({formatCurrency(expected)}) refreshes on the next change to the loan.
        </p>
      )}
    </div>
  );
}

function Body({ d, onClose }: { d: DeductionDetailDto; onClose: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Deduction · {formatPeriodLabel(d.period.label)}</DialogTitle>
        <DialogDescription>
          {d.customer.name}
          {d.customer.externalId && ` · IPPIS ${d.customer.externalId}`} · {d.loanId}
        </DialogDescription>
      </DialogHeader>
      <Separator className="bg-border" />
      <div className={`${dialogBodyClass} min-w-0 pt-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Expected this month</p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{formatCurrency(d.expected)}</p>
          </div>
          <StatusPill {...getDeductionStatusBadge(d.status)} />
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{STATUS_NOTE[d.status]}</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Figure label="Paid" value={formatCurrency(d.paid)} tone="text-success" />
          <Figure
            label="Outstanding"
            value={formatCurrency(d.outstanding)}
            tone={d.outstanding > 0 && (d.status === "PARTIAL" || d.status === "FAILED") ? "text-destructive" : undefined}
          />
          {d.settledAt && <Figure label="Settled" value={formatDate(d.settledAt)} />}
          {d.penalizedAt && <Figure label="Penalised" value={formatDate(d.penalizedAt)} tone="text-destructive" />}
        </div>

        <Separator className="bg-border" />
        <section className="space-y-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">How the amount is worked out</h3>
          {d.calculation ? (
            <Calculation calc={d.calculation} expected={d.expected} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Fixed when {formatPeriodLabel(d.period.label)} was sent to payroll: what was still owed beyond earlier
              months, spread over the months left at that point.
            </p>
          )}
        </section>

        <Separator className="bg-border" />
        <section className="space-y-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Payments applied</h3>
          {d.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment has reached this deduction yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {d.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {getInflowSourceBadge(p.source).label} · {formatDate(p.createdAt)}
                    </p>
                  </div>
                  <RepaymentDetailsModal
                    from="deduction"
                    repayment={{
                      ...p,
                      loanId: d.loanId,
                      deductionId: d.id,
                      periodLabel: d.period.label,
                      customer: d.customer,
                    }}
                    trigger={
                      <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1 text-xs">
                        Breakdown <Icon icon={icons.chevronRight} size={14} />
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="flex-1 bg-muted text-sm font-medium text-muted-foreground">
            Close
          </Button>
        </DialogFooter>
      </div>
    </>
  );
}

/** A month's deduction: its status, what was paid against it and, while OPEN, how its amount is computed. */
export function DeductionDetailsModal({ id, trigger }: { id: string; trigger?: JSX.Element }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useQuery({ ...deductionInfo(id), enabled: open });
  const deduction = data?.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="text-xs">
            <Icon icon={icons.view} size={12} className="mr-1" />
            View
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-lg sm:max-w-[500px]">
        {isLoading ? (
          <>
            <DialogHeader>
              <DialogTitle>Loading deduction…</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center px-4 pb-8 sm:px-5">
              <Icon icon={icons.loaderCircle} size={32} className="animate-spin text-muted-foreground" />
            </div>
          </>
        ) : error ? (
          <>
            <DialogHeader>
              <DialogTitle>Error</DialogTitle>
            </DialogHeader>
            <p className="break-words px-4 pb-4 text-center text-destructive sm:px-5 sm:pb-5">{error.message}</p>
          </>
        ) : deduction ? (
          <Body d={deduction} onClose={() => setOpen(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
