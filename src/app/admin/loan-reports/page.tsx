import { SiteSubHeader } from "@/components/site-sub-header";
import { DownloadReportDialogAdminDashbord } from "@/ui/admin-dashboard/download-report";
import DisbursementsChart from "@/ui/admin-loan-report/line-chart-disbursmen";
import { SectionLoanReport } from "@/ui/admin-loan-report/section-cards";
import LoanReportTable from "@/ui/admin-loan-report/table-loan-report";

export default function LoanReports() {
  return (
    <div className="@container/main flex flex-col gap-3 py-4 px-4">
      <SiteSubHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "Loan Reports", isCurrentPage: true },
        ]}
        rightContent={<DownloadReportDialogAdminDashbord />}
      />
      <SectionLoanReport />

      <DisbursementsChart />
      <LoanReportTable />
    </div>
  );
}
