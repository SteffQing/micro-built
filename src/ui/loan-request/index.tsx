import { SiteSubHeader } from "@/components/site-sub-header";
import { SectionCardsUserDashboard } from "./section-card";
import UserLoanRequestHistoryTable from "./table-request-history";
import RequestLoanModal from "../modals/request-loan";

export function UserLoanRequestPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <SiteSubHeader
        breadcrumbs={[{ label: "Loan/ Asset Request", isCurrentPage: true }]}
        rightContent={<HeaderRightContent />}
      />
      <SectionCardsUserDashboard />
      <UserLoanRequestHistoryTable />
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
