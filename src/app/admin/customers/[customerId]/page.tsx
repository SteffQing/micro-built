import { SiteSubHeader } from "@/components/site-sub-header";
import { ActiveLoans } from "@/ui/admin-customer-profile/active-lons";
import { DownloadReportDialogCustomerProfile } from "@/ui/admin-customer-profile/download-report";
import {
  activeLoans,
  customerProfile,
  repaymentHistory,
} from "@/ui/admin-customer-profile/dummy-data";
import {
  AdminActionCard,
  DefaultedLoansCard,
  PendingApplicationsCard,
  sampleApplications,
} from "@/ui/admin-customer-profile/loan-dashboard-cards";
import {
  CustomerProfileCard,
  LoanSummary,
} from "@/ui/admin-customer-profile/profile-detail-cards";
import { RepaymentHistoryTable } from "@/ui/admin-customer-profile/table-repayment-history";

export default async function CustomersPage() {
  const customerId = "CS39502";
  const breadcrumbs = [
    { label: "Dashboard", href: "/admin" },
    { label: "Customers", href: "/admin/customers" },
    {
      label: "Customers Profile",
      isCurrentPage: true,
      href: `/admin/customers/${customerId}`,
    },
  ];

  return (
    <div className="flex flex-col h-full px-4 @container/main py-4 md:py-6 gap-4">
      <SiteSubHeader
        breadcrumbs={breadcrumbs}
        rightContent={<DownloadReportDialogCustomerProfile />}
      />
      <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-7 gap-4">
        <div className="col-span-5 space-y-3">
          <div className="flex gap-2 w-full justify-between">
            <CustomerProfileCard customer={customerProfile} />
            <LoanSummary customer={customerProfile} />
          </div>
          <ActiveLoans loans={activeLoans} />
          <RepaymentHistoryTable
            history={repaymentHistory}
            customerName={customerProfile.name}
          />
        </div>
        <div className="col-span-2 space-y-3">
          <DefaultedLoansCard />
          <AdminActionCard />
          <PendingApplicationsCard applications={sampleApplications} />
        </div>
      </div>
    </div>
  );
}
