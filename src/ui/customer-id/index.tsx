"use client";

import { SiteSubHeader } from "@/components/site-sub-header";
import { DownloadReportDialogCustomerProfile } from "./download-report";
import { CustomerProfileCard, LoanSummary } from "./profile-detail-cards";
import { RepaymentHistoryTable } from "./table-repayment-history";

import { useUserProvider } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { customerQuery } from "@/lib/queries/admin/customer";
import LoansWrapper from "./loans";
import { Loader2 } from "lucide-react";

export default function CustomerDetailPage({
  customerId,
}: {
  customerId: string;
}) {
  const breadcrumbs = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Customers", href: "/customers" },
    {
      label: "Customers Profile",
      isCurrentPage: true,
      href: `/admin/customers/${customerId}`,
    },
  ];

  const { userRole, isUserLoading, errorUser } = useUserProvider();

  const {
    data,
    isLoading: isFetchingCustomer,
    isError,
  } = useQuery({
    ...customerQuery(customerId),
  });

  const customer = data?.data;
  const isLoading = isUserLoading || isFetchingCustomer;
  const hasError = errorUser || isError;
  const isUnauthorized = userRole === "CUSTOMER";
  const isAuthorized = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center h-full w-full">
          <div className="flex items-center gap-2">
            <p>Loading...</p>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          </div>
        </div>
      ) : isUnauthorized ? (
        <p>Not applicable to customer</p>
      ) : hasError ? (
        <div>An error occurred</div>
      ) : !isAuthorized ? (
        <div>Unauthorized access</div>
      ) : !customer ? (
        <div>Customer not found</div>
      ) : (
        <div className="flex flex-col h-full px-4 @container/main py-4 md:py-6 gap-4">
          <SiteSubHeader
            breadcrumbs={breadcrumbs}
            rightContent={<DownloadReportDialogCustomerProfile />}
          />
          <div className="col-span-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full justify-between">
              <CustomerProfileCard {...customer} />
              <LoanSummary id={customer.id} />
            </div>
            <LoansWrapper id={customer.id} />
            <RepaymentHistoryTable id={customer.id} name={customer.name} />
          </div>
        </div>
      )}
    </>
  );
}
