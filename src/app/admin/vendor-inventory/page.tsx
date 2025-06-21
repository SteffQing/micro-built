import { SiteSubHeader } from "@/components/site-sub-header";
import { DownloadReportDialogAdminDashbord } from "@/ui/admin-dashboard/download-report";
import { SectionCardsLoanDashboard } from "@/ui/admin-loan-management/section-cards";
import { VendorInventoryTable } from "@/ui/admin-vendor-inventory/table-vendor-innventory";
import { repaymentHistory } from "@/ui/admin-customer-profile/dummy-data";

export default function VendorInventory() {
  return (
    <div className="@container/main flex flex-col gap-3 py-4 px-4">
      <SiteSubHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "Vendor Inventory", isCurrentPage: true },
        ]}
        rightContent={<DownloadReportDialogAdminDashbord />}
      />
      <SectionCardsLoanDashboard />
      <VendorInventoryTable
        history={repaymentHistory}
        customerName="John Doe"
      />
    </div>
  );
}
