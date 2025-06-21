import { SiteSubHeader } from "@/components/site-sub-header";
import { DownloadReportDialogAdminDashbord } from "@/ui/admin-dashboard/download-report";
import { SectionCardsUserDashboard } from "@/ui/user-dashboard/section-card";
import UserRecentActivityTable from "@/ui/user-dashboard/table-recent-activities";

export default function Page() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <SiteSubHeader
        breadcrumbs={[{ label: "Dashboard", isCurrentPage: true }]}
        rightContent={<DownloadReportDialogAdminDashbord />}
      />
      <SectionCardsUserDashboard />
      <UserRecentActivityTable/>
   
    </div>
  );
}
