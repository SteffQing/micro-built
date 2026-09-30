import { Badge } from "@/components/ui/badge";
import type { VariationRow } from "@/lib/payroll/variations";

const amount = (value: string) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    Number(value),
  );
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos" }).format(
        new Date(value),
      )
    : "—";

export function VariationRows({ rows }: { rows: VariationRow[] }) {
  if (!rows.length)
    return (
      <p className="rounded-lg border bg-muted/30 p-4 text-sm">
        No payroll changes to send. Unchanged customers continue their existing
        deductions.
      </p>
    );
  return (
    <div
      className="max-h-72 min-w-0 max-w-full overflow-auto rounded-lg border"
      tabIndex={0}
      role="region"
      aria-label="Payroll changes"
    >
      <table className="w-full min-w-[640px] text-left text-xs">
        <caption className="sr-only">
          One final deduction instruction per changed customer
        </caption>
        <thead className="sticky top-0 bg-muted">
          <tr>
            {[
              "Customer / IPPIS",
              "Action and reason",
              "Previous deduction",
              "New deduction",
              "Effective / end",
              "Months left",
            ].map((label) => (
              <th scope="col" key={label} className="p-3 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.borrowerId} className="border-t align-top">
              <td className="p-3">
                <p className="font-medium">{row.borrowerName}</p>
                <p className="mt-1 text-muted-foreground">{row.externalId}</p>
              </td>
              <td className="p-3">
                <Badge variant="outline">{row.action}</Badge>
                <p className="mt-1 min-w-32">{row.reasons.join("; ")}</p>
              </td>
              <td className="whitespace-nowrap p-3">
                {row.previousAmount === null ? "—" : amount(row.previousAmount)}
              </td>
              <td className="whitespace-nowrap p-3 font-medium">
                {amount(row.amount)}
              </td>
              <td className="whitespace-nowrap p-3">
                {date(row.effectiveFromPeriod)}
                <br />
                {date(row.endDate)}
              </td>
              <td className="p-3">{row.termRemaining}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
