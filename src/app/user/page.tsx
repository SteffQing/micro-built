import { SiteSubHeader } from "@/components/site-sub-header";
import { DownloadReportDialogAdminDashbord } from "@/ui/dashboard/admin-dashboard/download-report";
import { SectionCardsUserDashboard } from "@/ui/dashboard/user-dashboard/section-card";
import UserRecentActivityTable from "@/ui/dashboard/user-dashboard/table-recent-activities";

export default function Page() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <SiteSubHeader
        breadcrumbs={[{ label: "Dashboard", isCurrentPage: true }]}
        rightContent={<DownloadReportDialogAdminDashbord />}
      />
      <SectionCardsUserDashboard />
      <UserRecentActivityTable />
    </div>
  );
}
