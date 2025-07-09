import { SiteSubHeader } from "@/components/site-sub-header";
// import { SectionCardsUserDashboard } from "./section-card";
// import UserRecentActivityTable from "./table-recent-activities";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCardsLoanManagement } from "./section-cards";
// import { LoanApplicationModal } from "./loan-application-dialog";

export function AdminLoanManagementPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <SiteSubHeader
        breadcrumbs={[{ label: "Loan management", isCurrentPage: true }]}
        rightContent={<HeaderRightContent />}
      />
      <SectionCardsLoanManagement />
      {/* <UserRecentActivityTable /> */}
    </div>
  );
}

const HeaderRightContent = () => {
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary">
        Quick Action <ChevronDown className="w-3 h-3" />
      </Button>
      {/* <LoanApplicationModal /> */}
    </div>
  );
};
