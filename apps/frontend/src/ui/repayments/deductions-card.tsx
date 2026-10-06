import { format } from "date-fns";
import { type IconData, icons } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";
import { cn, formatCurrency, formatPeriodLabel } from "@/lib/utils";

type Next = { amount: number; period: string } | null | undefined;
type Last = { amount: number; period: string; date: Date | string } | null | undefined;

/** The customer's upcoming and most recent payroll deduction, side by side (dashboard and repayments page). */
export function DeductionsCard({
  next,
  last,
  nextLabel = "Next deduction",
  loading,
  className,
}: {
  next: Next;
  last: Last;
  nextLabel?: string;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("@container grid min-w-0 overflow-hidden rounded-[12px] border border-border bg-card", className)}>
      <div className="grid h-full grid-cols-1 gap-px bg-border @xs:grid-cols-2 [&>*]:bg-card">
        <Cell
          icon={icons.calendarClock}
          tone="warning"
          label={nextLabel}
          loading={loading}
          value={next ? formatCurrency(next.amount) : null}
          detail={next ? `For ${formatPeriodLabel(next.period)}` : "Nothing scheduled"}
        />
        <Cell
          icon={icons.checkCircle}
          tone="success"
          label="Last deduction"
          loading={loading}
          value={last ? formatCurrency(last.amount) : null}
          detail={
            last
              ? `${formatPeriodLabel(last.period)} · received ${format(new Date(last.date), "d MMM yyyy")}`
              : "None received yet"
          }
        />
      </div>
    </div>
  );
}

function Cell({
  icon,
  tone,
  label,
  value,
  detail,
  loading,
}: {
  icon: IconData;
  tone: "warning" | "success";
  label: string;
  value: string | null;
  detail: string;
  loading?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 p-4 lg:p-5">
      <span className="mb-auto pb-4 lg:pb-5">
        <IconTile icon={icon} tone={value ? tone : "neutral"} />
      </span>
      <p className="truncate text-sm text-muted-foreground">{label}</p>
      {loading ? (
        <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
      ) : (
        <h3
          className={cn(
            "truncate text-2xl font-semibold tabular-nums",
            value ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {value ?? "—"}
        </h3>
      )}
      <p className="-mt-1 truncate text-xs text-muted-foreground" title={detail}>
        {loading ? " " : detail}
      </p>
    </div>
  );
}
