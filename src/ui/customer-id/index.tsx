"use client";

import { SiteSubHeader } from "@/components/site-sub-header";
import { DownloadReportDialogCustomerProfile } from "./download-report";
import { CustomerProfileCard, LoanSummary } from "./profile-detail-cards";
import { RepaymentHistoryTable } from "./table-repayment-history";

import { useUserProvider } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { customerQuery } from "@/lib/queries/admin/customer";
import LoansWrapper from "./loans";

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

  const { data, isError, error } = useQuery({
    ...customerQuery(customerId),
  });

  const customer = data?.data;
  if (!customer) {
    return (
      <div>
        <p>Customer not found</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <p>{error.message}</p>
      </div>
    );
  }
  return (
    <>
      {userRole === "CUSTOMER" ? (
        <p>Not applicable to customer</p>
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        <div className="flex flex-col h-full px-4 @container/main py-4 md:py-6 gap-4">
          <SiteSubHeader
            breadcrumbs={breadcrumbs}
            rightContent={<DownloadReportDialogCustomerProfile />}
          />
          <div className="col-span-5 space-y-3">
            <div className="flex gap-2 w-full justify-between">
              <CustomerProfileCard {...customer} />
              <LoanSummary id={customer.id} />
            </div>
            <LoansWrapper id={customer.id} />
            <RepaymentHistoryTable id={customer.id} name={customer.name} />
          </div>

        </div>
      ) : // </div>
      !isUserLoading && errorUser ? (
        <div>An ERROR Occured</div>
      ) : (
        <div>UNKNOWN Eror occured contact admin</div>
      )}
    </>
  );
}
