import { SectionCardsUserDashboard } from "./section-card";
import UserRecentActivityTable from "./table";
import RequestLoanModal from "@/ui/modals/request-loan";
import PageTitle from "@/components/page-title";

export function UserDashboardPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <PageTitle title="Dashboard" actionContent={<RequestLoanModal />} />
      <SectionCardsUserDashboard />
      <UserRecentActivityTable />
    </div>
  );
}
