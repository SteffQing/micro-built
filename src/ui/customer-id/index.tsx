"use client";

import { SiteSubHeader } from "@/components/site-sub-header";
import { DownloadReportDialogCustomerProfile } from "./download-report";
import { CustomerProfileCard, LoanSummary } from "./profile-detail-cards";
import { RepaymentHistoryTable } from "./table-repayment-history";
import { useQuery } from "@tanstack/react-query";
import { customerQuery } from "@/lib/queries/admin/customer";
import LoansWrapper from "./loans";
import UserInfo from "./user-info";
import { CustomerProfileCardSkeleton } from "./skeletons/profile";

export default function CustomerDetailPage({ customerId }: { customerId: string }) {
  const breadcrumbs = [
    { label: "Customers", href: "/customers" },
    {
      label: "Customer Profile",
      isCurrentPage: true,
      href: `/admin/customers/${customerId}`,
    },
  ];

  const { data, isLoading } = useQuery(customerQuery(customerId));
  const customer = data?.data;

  return (
    <div className="flex flex-col h-full px-4 @container/main py-4 md:py-6 gap-4">
      <SiteSubHeader breadcrumbs={breadcrumbs} rightContent={<DownloadReportDialogCustomerProfile />} />
      <div className="col-span-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full justify-between">
          {isLoading ? <CustomerProfileCardSkeleton /> : customer && <CustomerProfileCard {...customer} />}
          <LoanSummary id={customerId} />
        </div>
        <UserInfo id={customerId} />
        <LoansWrapper id={customerId} />
        <RepaymentHistoryTable id={customerId} name={customer?.name || ""} />
      </div>
    </div>
  );
}
