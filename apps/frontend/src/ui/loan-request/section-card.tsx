import { useQuery } from "@tanstack/react-query";
import { userLoanOverview } from "@/lib/queries/user/loan";
import ReportCard from "@/components/report-card";
import { icons } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";

export function SectionCardsUserDashboard() {
  const { data, isLoading } = useQuery(userLoanOverview);
  const overview = data?.data;
  // pendingLoans and pendingTopups hold everything not yet paid out, approved included: split them by status so an
  // approved request isn't also counted as pending.
  const loans = overview?.pendingLoans ?? [];
  const topups = overview?.pendingTopups ?? [];
  const pendingLoanRequest =
    loans.filter((loan) => loan.status === "PENDING").length +
    topups.filter((topup) => topup.status === "PENDING").length +
    (overview?.commoditiesInReview.length ?? 0);
  const approvedLoans =
    loans.filter((loan) => loan.status === "APPROVED").length +
    topups.filter((topup) => topup.status === "APPROVED").length;
  const rejectedLoans = overview?.rejectedCount || 0;
  const disbursedLoans = overview?.disbursedCount || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 justify-between w-full">
      <ReportCard
        title="Pending Requests"
        description="Loans, top-ups and asset requests waiting for a decision"
        loading={isLoading}
        value={pendingLoanRequest.toString()}
        icon={<IconTile icon={icons.alert} tone="warning" />}
      />
      <ReportCard
        title="Approved Requests"
        description="Approved loans and top-ups waiting to be paid out"
        loading={isLoading}
        value={approvedLoans.toString()}
        icon={<IconTile icon={icons.checkCircle} tone="success" />}
      />
      <ReportCard
        title="Rejected Requests"
        loading={isLoading}
        value={rejectedLoans.toString()}
        icon={<IconTile icon={icons.alertTriangle} tone="danger" />}
      />
      <ReportCard
        title="Disbursed Loans"
        description="Loans paid out and still running"
        loading={isLoading}
        value={disbursedLoans.toString()}
        icon={<IconTile icon={icons.moneyReceive} />}
      />
    </div>
  );
}
