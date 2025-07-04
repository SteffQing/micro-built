import { SiteSubHeader } from "@/components/site-sub-header";
import { DownloadReportDialogAdminDashbord } from "@/ui/dashboard/admin-dashboard/download-report";
import { RepaymentHistoryTable } from "@/ui/admin-repaymemts/table-repayment-history";
import { repaymentHistory } from "@/ui/admin-customer-profile/dummy-data";
import { SectionCardsLoanDashboard } from "@/ui/admin-loan-management/section-cards";

export default function Repayments() {
  return (
    <div className="@container/main flex flex-col gap-3 py-4 px-4">
      <SiteSubHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "Repayments", isCurrentPage: true },
        ]}
        rightContent={<DownloadReportDialogAdminDashbord />}
      />
      <SectionCardsLoanDashboard />
      <RepaymentHistoryTable
        history={repaymentHistory}
        customerName="John Doe"
      />
    </div>
  );
}
