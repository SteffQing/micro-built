import { DownloadReportDialogAdminDashbord } from "@/ui/admin-dashboard/download-report";
import { SectionCardsLoanDashboard } from "@/ui/loan-management/section-cards";
import { SiteSubHeader } from "@/components/site-sub-header";
import InterestsManagementChart from "@/ui/loan-management/loan-interest-chart";

export default function LoanManagementPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <SiteSubHeader
        breadcrumbs={[{ label: "Dashboard", isCurrentPage: true }]}
        rightContent={<DownloadReportDialogAdminDashbord />}
      />
      <SectionCardsLoanDashboard />
      <InterestsManagementChart />
    </div>
  );
}
