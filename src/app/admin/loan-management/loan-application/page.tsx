import { SiteSubHeader } from "@/components/site-sub-header";
import { DownloadReportDialogAdminDashbord } from "@/ui/admin-dashboard/download-report";
import LoanManagementTable from "@/ui/loan-management/loan-management-table";
import { SectionCardsLoanDashboard } from "@/ui/loan-management/section-cards";

export default function LoanApplication() {
  return (
    <div className="@container/main flex flex-col gap-3 py-4 px-4">
      <SiteSubHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "Loan Management", href: "/admin/loan-management" },
          { label: "Loan Application", isCurrentPage: true },
        ]}
        rightContent={<DownloadReportDialogAdminDashbord />}
      />
      <SectionCardsLoanDashboard />
      <LoanManagementTable />
    </div>
  );
}
