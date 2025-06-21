import { SiteSubHeader } from "@/components/site-sub-header";
import { DownloadReportDialogAdminDashbord } from "@/ui/admin-dashboard/download-report";
import { SectionCardsLoanDashboard } from "@/ui/loan-management/section-cards";
import { UnmatchedPaymentReviewTable } from "@/ui/reconcilation-tool/table-unmatched-payment";
import { repaymentHistory } from "@/ui/admin-customer-profile/dummy-data";
import { FlaggedPaymentReviewTable } from "@/ui/reconcilation-tool/table-flagged-payment";
import ReconcilationToolCards from "@/ui/reconcilation-tool/tools";

export default function ReconciliationTool() {
  return (
    <div className="@container/main flex flex-col gap-3 py-4 px-4">
      <SiteSubHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "Reconciliation Tool", isCurrentPage: true },
        ]}
        rightContent={<DownloadReportDialogAdminDashbord />}
      />
      <SectionCardsLoanDashboard />

      <div className="grid grid-cols-7 gap-4">
        <div className="col-span-5 space-y-4">
          <UnmatchedPaymentReviewTable
            history={repaymentHistory}
            customerName="John Doe"
          />
          <FlaggedPaymentReviewTable
            history={repaymentHistory}
            customerName="John Doe"
          />
        </div>
        <ReconcilationToolCards />
      </div>
    </div>
  );
}
