import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { IconsIllustration } from "@/components/icons-illustrations";
import { useQuery } from "@tanstack/react-query";
import { repaymentsOverview } from "@/lib/queries/admin/repayment";
import ReportCard from "@/components/report-card";
import { formatCurrency } from "@/lib/utils";

export function SectionCardsUserRepayment() {
  const { data } = useQuery(repaymentsOverview);

  return (
    <div className="lg:grid lg:grid-cols-4 flex flex-col gap-2 justify-between w-full">
      <ReportCard
        title="Total Expenditure"
        value={formatCurrency(data?.data?.totalExpected || 0)}
        icon={<IconsIllustration.pending_contract className="h-10" />}
      />
      <ReportCard
        title="Total Amount Repaid"
        value={formatCurrency(data?.data?.totalRepaid || 0)}
        icon={<IconsIllustration.approved_contract className="h-10" />}
      />
      <ReportCard
        title="Underpayments"
        value={data?.data?.underpaymentsCount.toString() || "0"}
        icon={<IconsIllustration.rejected_contract className="h-10" />}
      />
      <ReportCard
        title="Failed Deductions"
        value={data?.data?.failedDeductionsCount.toString() || "0"}
        icon={<IconsIllustration.disbursed_contract className="h-10" />}
      />
    </div>
  );
}
