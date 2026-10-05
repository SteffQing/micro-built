import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import type { VariationAction, VariationRow } from "@/lib/payroll/variations";

export const actionLabels: Record<VariationAction, string> = {
  START: "Start",
  AMEND: "Amend",
  STOP: "Stop",
};

export const actionTone: Record<VariationAction, string> = {
  START: "bg-success/12 text-success",
  AMEND: "bg-warning/12 text-warning",
  STOP: "bg-destructive/12 text-destructive",
};

export function VariationRowsSkeleton() {
  return (
    <div className="grid gap-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function VariationRows({ rows }: { rows: VariationRow[] }) {
  if (!rows.length)
    return (
      <p className="rounded-lg border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        No payroll changes for this selection. Unchanged customers continue
        their existing deductions.
      </p>
    );
  return (
    <div
      className="max-h-64 min-w-0 max-w-full overflow-auto rounded-lg border"
      tabIndex={0}
      role="region"
      aria-label="Payroll changes"
    >
      <table className="w-full min-w-[480px] text-left text-xs">
        <caption className="sr-only">
          Deduction changes payroll must apply for the month
        </caption>
        <thead className="sticky top-0 bg-muted">
          <tr>
            {["Customer", "Action", "Amount", "Start – end"].map((label) => (
              <th scope="col" key={label} className="p-2.5 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.loanId} className="border-t align-top">
              <td className="p-2.5">
                <p className="font-medium">{row.name}</p>
                <p className="text-muted-foreground">{row.externalId ?? "—"}</p>
              </td>
              <td className="p-2.5">
                <Badge
                  variant="outline"
                  className={cn("border-transparent", actionTone[row.action])}
                >
                  {actionLabels[row.action]}
                </Badge>
              </td>
              <td className="whitespace-nowrap p-2.5 font-medium">
                {formatCurrency(row.amount)}
              </td>
              <td className="whitespace-nowrap p-2.5">
                {row.start} – {row.end}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
