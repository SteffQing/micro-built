import { SiteSubHeader } from "@/components/site-sub-header";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCardsLoanManagement } from "./section-cards";
import InterestsManagementChart from "./loan-interest-chart";
import InterestRateCard from "./interest-rate-card";
import { LoanManagementTable } from "./loan-management-table";
import UserRecentActivityTable from "../dashboard/user-dashboard/table-recent-activities";

export function AdminLoanManagementPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <SiteSubHeader
        breadcrumbs={[{ label: "Loan management", isCurrentPage: true }]}
        rightContent={<HeaderRightContent />}
      />
      <SectionCardsLoanManagement />
      <div className=" ">
        <InterestsManagementChart />
        {/* <InterestRateCard /> */}
      </div>
      <LoanManagementTable />
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
