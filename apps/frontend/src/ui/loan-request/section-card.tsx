import { IconsIllustration } from "@/components/icons-illustrations";
import { useQuery } from "@tanstack/react-query";
import { userLoanOverview } from "@/lib/queries/user/loan";
import ReportCard from "@/components/report-card";

export function SectionCardsUserDashboard() {
  const { data, isLoading } = useQuery(userLoanOverview);
  const pendingLoanRequest = data?.data?.pendingLoans.length || 0;
  const rejectedLoans = data?.data?.rejectedCount || 0;
  const approvedLoans = data?.data?.approvedCount || 0;
  const disbursedLoans = data?.data?.disbursedCount || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 justify-between w-full">
      <ReportCard
        title="Pending Requests"
        loading={isLoading}
        value={pendingLoanRequest.toString()}
        icon={<IconsIllustration.pending_contract className="h-10" />}
      />
      <ReportCard
        title="Approved Requests"
        loading={isLoading}
        value={approvedLoans.toString()}
        icon={<IconsIllustration.approved_contract className="h-10" />}
      />
      <ReportCard
        title="Rejected Requests"
        loading={isLoading}
        value={rejectedLoans.toString()}
        icon={<IconsIllustration.rejected_contract className="h-10" />}
      />
      <ReportCard
        title="Disbursed Requests"
        loading={isLoading}
        value={disbursedLoans.toString()}
        icon={<IconsIllustration.disbursed_contract className="h-10" />}
      />
    </div>
  );
}
