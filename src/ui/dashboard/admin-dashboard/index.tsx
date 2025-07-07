import { SiteSubHeader } from "@/components/site-sub-header";
// import UserRecentActivityTable from "./table-recent-activities";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCardsAdminDashboad } from "./section-cards";
import LoanDisbursementChart from "./chart-area-intective";
import LoanRequestTableAdminDashboard from "./loan-request-table";
// import { LoanApplicationModal } from "./loan-application-dialog";

export function AdminDashboardPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <SiteSubHeader
        breadcrumbs={[{ label: "Dashboard", isCurrentPage: true }]}
        rightContent={<HeaderRightContent />}
      />
      <SectionCardsAdminDashboad />
      {/* <UserRecentActivityTable /> */}

      <div className=" gap-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7">
        <div className="space-y-4 md:col-span-2 lg:col-span-5">
          <LoanDisbursementChart />

          <div className="mt-4"><LoanRequestTableAdminDashboard /></div>

          <div className="mt-4">{/* <RepaymentTableAdminDashboard /> */}</div>
        </div>

        <div className="space-y-4 md:col-span-1 lg:col-span-2">
          {/* <CustomerStatsCard />
          <LoanOverviewPieChart />
          <InventoryAlertsCard /> */}
        </div>
      </div>
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
