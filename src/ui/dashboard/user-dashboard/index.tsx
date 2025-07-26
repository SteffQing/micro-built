import { SiteSubHeader } from "@/components/site-sub-header";
import { SectionCardsUserDashboard } from "./section-card";
import UserRecentActivityTable from "./table-recent-activities";
import RequestLoanModal from "@/ui/modals/request-loan";

export function UserDashboardPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <SiteSubHeader
        breadcrumbs={[{ label: "Dashboard", isCurrentPage: true }]}
        rightContent={<HeaderRightContent />}
      />
      <SectionCardsUserDashboard />
      <UserRecentActivityTable />
    </div>
  );
}

const HeaderRightContent = () => {
  return (
    <div className="flex items-center gap-2">
      <RequestLoanModal />
    </div>
  );
};
