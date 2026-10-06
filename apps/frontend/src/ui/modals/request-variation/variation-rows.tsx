import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  VariationAction,
  VariationReason,
  VariationRow,
} from "@/lib/payroll/variations";

export const actionLabels: Record<VariationAction, string> = {
  START: "Start",
  AMEND: "Amend",
  STOP: "Stop",
};

export const actionHints: Record<VariationAction, string> = {
  START: "New deductions",
  AMEND: "Changed amounts",
  STOP: "Deductions to end",
};

export const actionTone: Record<VariationAction, string> = {
  START: "bg-success/12 text-success",
  AMEND: "bg-warning/12 text-warning",
  STOP: "bg-destructive/12 text-destructive",
};

const actionDot: Record<VariationAction, string> = {
  START: "bg-success",
  AMEND: "bg-warning",
  STOP: "bg-destructive",
};

const reasonLabels: Record<VariationReason, string> = {
  NEW_LOAN: "New loan",
  TOPUP: "Top-up",
  LIQUIDATION: "Liquidation",
  TENURE_CHANGE: "Tenure change",
  DEFAULT: "Missed payment",
};

export function VariationRowsSkeleton() {
  return (
    <div className="divide-y rounded-xl border" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="size-2 rounded-full" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/** One line per loan whose deduction changes: who, what payroll must do, the amount and the months it runs. */
export function VariationRows({ rows }: { rows: VariationRow[] }) {
  if (!rows.length)
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <p className="text-sm font-medium">No changes for this selection</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Customers who aren&apos;t listed keep their current deductions.
        </p>
      </div>
    );
  return (
    <ul
      className="max-h-72 divide-y overflow-y-auto rounded-xl border"
      tabIndex={0}
      aria-label="Payroll changes"
    >
      {rows.map((row) => (
        <li key={row.loanId} className="flex items-start gap-3 p-3">
          <span
            className={cn("mt-1.5 size-2 shrink-0 rounded-full", actionDot[row.action])}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="truncate text-sm font-medium">{row.name}</p>
              <p className="text-sm font-semibold tabular-nums">
                {row.action === "STOP" ? "—" : formatCurrency(row.amount)}
              </p>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <p className="truncate">
                {row.externalId ?? "No IPPIS"}
                {row.command ? ` · ${row.command}` : ""}
              </p>
              <p className="tabular-nums">
                {row.action === "STOP"
                  ? `Stop from ${row.start}`
                  : `${row.start} – ${row.end}`}
              </p>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                  actionTone[row.action],
                )}
              >
                {actionLabels[row.action]}
              </span>
              {row.reasons.map((reason) => (
                <span
                  key={reason}
                  className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {reasonLabels[reason]}
                </span>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
