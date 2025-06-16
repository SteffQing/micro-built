import { DownloadReportDialogAdminDashbord } from "@/ui/admin-dashboard/download-report";
import { SectionCardsLoanDashboard } from "@/ui/loan-management/section-cards";
import { SiteSubHeader } from "@/components/site-sub-header";
import InterestsManagementChart from "@/ui/loan-management/loan-interest-chart";
import InterestRateCard from "@/ui/loan-management/interest-rate-card";
import LoanManagementTable from "@/ui/loan-management/loan-management-table";

export default function LoanManagementPage() {
  return (
    <div className="@container/main flex flex-col gap-3 py-4 px-4">
      <SiteSubHeader
        breadcrumbs={[{ label: "Dashboard", isCurrentPage: true }]}
        rightContent={<DownloadReportDialogAdminDashbord />}
      />
      <SectionCardsLoanDashboard />
      <div className="grid grid-cols-7 gap-1 ">
        <InterestsManagementChart />
        <InterestRateCard />
      </div>
      <LoanManagementTable/>
    </div>
  );
}
