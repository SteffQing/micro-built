import { useQuery } from "@tanstack/react-query";
import { repaymentsOverview } from "@/lib/queries/admin/repayment";
import ReportCard from "@/components/report-card";
import { formatCurrency } from "@/lib/utils";
import type { PeriodRangeValue } from "@/components/period-range-filter";
import { icons } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";

export function SectionCardsUserRepayment({ period }: { period: PeriodRangeValue }) {
  const range = period.from && period.to ? period : undefined;
  const { data, isLoading } = useQuery(repaymentsOverview(range));

  const received = data?.data?.received;
  const applied = data?.data?.applied;
  const unresolved = data?.data?.unresolved;
  const sources = received
    ? (
        [
          ["payroll", received.bySource.PAYROLL],
          ["liquidations", received.bySource.LIQUIDATION],
          ["imports", received.bySource.IMPORT],
        ] as const
      )
        .filter(([, amount]) => amount > 0)
        .map(([label, amount]) => `${formatCurrency(amount)} ${label}`)
        .join(" · ")
    : "";

  return (
    <div className="lg:grid lg:grid-cols-3 flex flex-col gap-2 justify-between w-full">
      {/* Money in: inflows and the repayments made from them, whatever deduction (if any) they settled. */}
      <ReportCard
        title="Received"
        value={`${formatCurrency(received?.amount || 0)} (${received?.count ?? 0})`}
        icon={<IconTile icon={icons.moneyReceive} tone="success" />}
        loading={isLoading}
        description={sources || "Money received for the selected period"}
      />
      <ReportCard
        title="Applied to Loans"
        value={formatCurrency(applied?.amount || 0)}
        icon={<IconTile icon={icons.checkCheck} tone="success" />}
        loading={isLoading}
        description={
          applied && applied.amount > 0
            ? `${formatCurrency(applied.principal)} principal · ${formatCurrency(applied.interest)} interest${applied.penalty > 0 ? ` · ${formatCurrency(applied.penalty)} penalty` : ""}`
            : "Received money applied to loan balances"
        }
      />
      <ReportCard
        title="Awaiting Resolution"
        value={`${formatCurrency(unresolved?.amount || 0)} (${unresolved?.count ?? 0})`}
        icon={<IconTile icon={icons.alert} tone="warning" />}
        loading={isLoading}
        description="Received money not yet matched, approved or settled (any period)"
      />
      {/* Deductions: what payroll was asked for and how it went. */}
      <ReportCard
        title="Expected"
        value={formatCurrency(data?.data?.expected || 0)}
        icon={<IconTile icon={icons.calendarClock} tone="warning" />}
        loading={isLoading}
        description="Total expected deductions for the selected period"
      />
      <ReportCard
        title="Collected via Payroll"
        value={formatCurrency(data?.data?.collected || 0)}
        icon={<IconTile icon={icons.checkCircle} tone="success" />}
        loading={isLoading}
        description="Payroll payments applied to those deductions"
      />
      <ReportCard
        title="Overdue"
        value={formatCurrency(data?.data?.overdue || 0)}
        icon={<IconTile icon={icons.alertTriangle} tone="danger" />}
        loading={isLoading}
        description="Shortfall on underpaid and failed deductions"
      />
      <ReportCard
        title="Underpaid"
        value={`${formatCurrency(data?.data?.underpaid?.amount || 0)} (${data?.data?.underpaid?.count ?? 0})`}
        icon={<IconTile icon={icons.alert} tone="danger" />}
        loading={isLoading}
        description="Deductions where the collected amount was less than expected"
      />
      <ReportCard
        title="Failed"
        value={`${formatCurrency(data?.data?.failed?.amount || 0)} (${data?.data?.failed?.count ?? 0})`}
        icon={<IconTile icon={icons.alert} tone="danger" />}
        loading={isLoading}
        description="Deductions that could not be collected (no payroll match)"
      />
      <ReportCard
        title="Expecting This Period"
        value={formatCurrency(data?.data?.expectingThisPeriod || 0)}
        icon={<IconTile icon={icons.wallet} />}
        loading={isLoading}
        description="Total expected for the current payroll period"
      />
    </div>
  );
}
