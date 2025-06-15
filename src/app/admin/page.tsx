import { SectionCardsAdminDashboad } from "@/ui/admin-dashboard/section-cards";
import LoanDisbursementChartAdmin from "@/ui/admin-dashboard/chart-area-intective";
import LoanRequestTableAdminDashboard from "@/ui/admin-dashboard/loan-request-table";
import RepaymentTableAdminDashboard from "@/ui/admin-dashboard/loan-repaymeny-table";
import { LoanOverviewPieChart } from "@/ui/admin-dashboard/loan-overview-piechart";
import InventoryAlertsCard from "@/ui/admin-dashboard/inventory-alert-card";
import CustomerStatsCard from "@/ui/admin-dashboard/customer-stats-card";
import { SiteSubHeader } from "@/components/site-sub-header";
import { DownloadReportDialogAdminDashbord } from "@/ui/admin-dashboard/download-report";

  /**
   * Page component for the admin dashboard.
   *
   * This component is the main component for the admin dashboard page.
   * It contains a site subheader with a download report dialog and a section
   * of cards with links to various pages.
   * It also contains a grid of three columns, with the first column containing a
   * loan disbursement chart and two tables for loan requests and repayments.
   * The second column contains a customer stats card, a loan overview pie chart,
   * and an inventory alerts card.
   */
export default function Page() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <SiteSubHeader
        breadcrumbs={[{ label: "Dashboard", isCurrentPage: true }]}
        rightContent={<DownloadReportDialogAdminDashbord />}
      />
      <SectionCardsAdminDashboad />
      <div className=" gap-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7">
        <div className="space-y-4 md:col-span-2 lg:col-span-5">
          <LoanDisbursementChartAdmin />

          <div className="mt-4">
            <LoanRequestTableAdminDashboard />
          </div>

          <div className="mt-4">
            <RepaymentTableAdminDashboard />
          </div>
        </div>

        <div className="space-y-4 md:col-span-1 lg:col-span-2">
          <CustomerStatsCard />
          <LoanOverviewPieChart />
          <InventoryAlertsCard />
        </div>
      </div>
    </div>
  );
}
