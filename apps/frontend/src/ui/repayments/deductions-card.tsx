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
    <div className={cn("grid min-w-0 overflow-hidden rounded-[12px] border border-border bg-card", className)}>
      {/* Always two columns: stacking them made the card twice as tall as its row's other cards. */}
      <div className="grid h-full grid-cols-2 gap-px bg-border [&>*]:bg-card">
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
              ? `${formatPeriodLabel(last.period)} · paid ${format(new Date(last.date), "d MMM")}`
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
    <div className="flex min-w-0 flex-col justify-between gap-3 p-4 lg:p-5">
      <div className="flex min-w-0 items-center gap-2">
        <IconTile icon={icon} tone={value ? tone : "neutral"} size="sm" />
        <p className="truncate text-sm text-muted-foreground">{label}</p>
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
        ) : (
          <h3
            className={cn(
              "truncate text-xl font-semibold tabular-nums",
              value ? "text-foreground" : "text-muted-foreground"
            )}
            title={value ?? undefined}
          >
            {value ?? "—"}
          </h3>
        )}
        <p className="mt-1 truncate text-xs text-muted-foreground" title={detail}>
          {loading ? " " : detail}
        </p>
      </div>
    </div>
  );
}
