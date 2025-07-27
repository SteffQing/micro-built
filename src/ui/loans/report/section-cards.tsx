import { IconsIllustration } from "@/components/icons-illustrations";
import { useQuery } from "@tanstack/react-query";
import { loanReportOverview } from "@/lib/queries/admin/dashboard";
import { formatCurrency } from "@/lib/utils";
import ReportCard from "@/components/report-card";

export function SectionCardsLoanManagement() {
  const { data } = useQuery(loanReportOverview);
  return (
    <div className="grid grid-cols-1 gap-2 justify-between w-full *:data-[slot=card]:shadow-xs @xl/main:grid-cols-3 @5xl/main:grid-cols-5">
      <ReportCard
        title="Amount Disbursed"
        value={formatCurrency(data?.data?.totalDisbursed)}
        icon={<IconsIllustration.money_out_icon className="h-10" />}
      />

      <ReportCard
        title="Amount Repaid"
        value={formatCurrency(data?.data?.totalRepaid)}
        icon={<IconsIllustration.alert_document className="h-10" />}
      />

      <ReportCard
        title="Interests Earned"
        value={formatCurrency(data?.data?.interestEarned)}
        icon={<IconsIllustration.earnings className="h-10" />}
      />

      <ReportCard
        title="Active Loans"
        value={(data?.data?.activeLoansCount ?? 0).toString()}
        icon={<IconsIllustration.active_document className="h-10" />}
      />

      <ReportCard
        title="Pending Loans"
        value={(data?.data?.pendingLoansCount ?? 0).toString()}
        icon={<IconsIllustration.completed_document className="h-10" />}
      />
    </div>
  );
}
