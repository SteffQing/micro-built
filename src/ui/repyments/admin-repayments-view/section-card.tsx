import { IconsIllustration } from "@/components/icons-illustrations";
import { useQuery } from "@tanstack/react-query";
import { repaymentsOverview } from "@/lib/queries/admin/repayment";
import ReportCard from "@/components/report-card";
import { formatCurrency } from "@/lib/utils";

export function SectionCardsUserRepayment() {
  const { data, isLoading } = useQuery(repaymentsOverview);

  return (
    <div className="lg:grid lg:grid-cols-4 flex flex-col gap-2 justify-between w-full">
      <ReportCard
        title="Total Expected"
        value={formatCurrency(data?.data?.totalExpected || 0)}
        icon={<IconsIllustration.pending_contract className="h-10" />}
        loading={isLoading}
      />
      <ReportCard
        title="Total Overdue"
        value={formatCurrency(data?.data?.totalOverdue || 0)}
        icon={<IconsIllustration.alert_document className="h-10" />}
        loading={isLoading}
      />
      <ReportCard
        title="Total Amount Repaid"
        value={formatCurrency(data?.data?.totalRepaid || 0)}
        icon={<IconsIllustration.approved_contract className="h-10" />}
        loading={isLoading}
      />
      <ReportCard
        title="Underpayments"
        value={data?.data?.underpaidCount.toString() || "0"}
        icon={<IconsIllustration.rejected_contract className="h-10" />}
        loading={isLoading}
      />
      <ReportCard
        title="Failed Deductions"
        value={data?.data?.failedDeductionsCount.toString() || "0"}
        icon={<IconsIllustration.disbursed_contract className="h-10" />}
        loading={isLoading}
      />
    </div>
  );
}
