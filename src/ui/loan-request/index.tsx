import { SiteSubHeader } from "@/components/site-sub-header";
import { SectionCardsUserDashboard } from "./section-card";
import UserLoanRequestHistoryTable from "./table-request-history";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <Button variant="secondary">
        Quick Action <ChevronDown className="w-3 h-3" />
      </Button>
      <RequestLoanModal />
    </div>
  );
};
