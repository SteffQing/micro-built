import { IconsIllustration } from "@/components/icons-illustrations";
import { useQuery } from "@tanstack/react-query";
import { repaymentsOverview } from "@/lib/queries/admin/repayment";
import ReportCard from "@/components/report-card";
import { formatCurrency } from "@/lib/utils";
import type { PeriodRangeValue } from "@/components/period-range-filter";

export function SectionCardsUserRepayment({ period }: { period: PeriodRangeValue }) {
  const range = period.from && period.to ? period : undefined;
  const { data, isLoading } = useQuery(repaymentsOverview(range));

  return (
    <div className="lg:grid lg:grid-cols-3 flex flex-col gap-2 justify-between w-full">
      <ReportCard
        title="Expected"
        value={formatCurrency(data?.data?.expected || 0)}
        icon={<IconsIllustration.pending_contract className="h-10" />}
        loading={isLoading}
        description="Total expected deductions for the selected period"
      />
      <ReportCard
        title="Collected"
        value={formatCurrency(data?.data?.collected || 0)}
        icon={<IconsIllustration.approved_contract className="h-10" />}
        loading={isLoading}
        description="Total collected deductions for the selected period"
      />
      <ReportCard
        title="Overdue"
        value={formatCurrency(data?.data?.overdue || 0)}
        icon={<IconsIllustration.alert_document className="h-10" />}
        loading={isLoading}
        description="Deductions past their expected period with no payment"
      />
      <ReportCard
        title="Underpaid"
        value={`${formatCurrency(data?.data?.underpaid?.amount || 0)} (${data?.data?.underpaid?.count ?? 0})`}
        icon={<IconsIllustration.rejected_contract className="h-10" />}
        loading={isLoading}
        description="Deductions where the collected amount was less than expected"
      />
      <ReportCard
        title="Failed"
        value={`${formatCurrency(data?.data?.failed?.amount || 0)} (${data?.data?.failed?.count ?? 0})`}
        icon={<IconsIllustration.disbursed_contract className="h-10" />}
        loading={isLoading}
        description="Deductions that could not be collected (no payroll match)"
      />
      <ReportCard
        title="Expecting This Period"
        value={formatCurrency(data?.data?.expectingThisPeriod || 0)}
        icon={<IconsIllustration.earnings className="h-10" />}
        loading={isLoading}
        description="Total expected for the current payroll period"
      />
    </div>
  );
}
