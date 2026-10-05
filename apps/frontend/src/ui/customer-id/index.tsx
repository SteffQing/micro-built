"use client";

import { useQuery } from "@tanstack/react-query";

import { SiteSubHeader } from "@/components/site-sub-header";
import { customerQuery } from "@/lib/queries/admin/customer";
import GenerateCustomerLoanReport from "../modals/customer-actions/generate-report";
import { CustomerProfileCard, LoanSummary } from "./profile-detail-cards";
import CustomerDetailsCard from "./customer-details-card";
import LoansWrapper from "./loans";
import RepaymentsAndLiquidations from "./repayments-liquidations";
import { CustomerProfileCardSkeleton } from "./skeletons/profile";
import LoanChanges from "./loan-changes";

interface Props {
  customerId: string;
  adminRole: UserRole;
}

export default function CustomerDetailPage({ customerId, adminRole }: Props) {
  const breadcrumbs = [
    { label: "Customers", href: "/customers" },
    {
      label: "Customer's Profile",
      isCurrentPage: true,
      href: `/customers/${customerId}`,
    },
  ];

  const { data, isLoading } = useQuery(customerQuery(customerId));
  const customer = data?.data;
  const name = customer?.name ?? "";

  return (
    <div className="@container/main flex flex-col gap-4 px-4 py-4 md:py-6">
      <SiteSubHeader
        breadcrumbs={breadcrumbs}
        rightContent={<GenerateCustomerLoanReport id={customerId} />}
      />

      {/* Profile beside a wide (3x2) loan summary so the two end at the same height; details get their own
          full-width row instead of a sparse third column. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(300px,1fr)_minmax(0,2fr)] *:min-w-0">
        {isLoading || !customer ? (
          <CustomerProfileCardSkeleton />
        ) : (
          <CustomerProfileCard {...customer} adminRole={adminRole} />
        )}
        <LoanSummary id={customerId} name={name} />
      </div>

      <CustomerDetailsCard id={customerId} />

      <LoansWrapper id={customerId} name={name} />

      <LoanChanges customerId={customerId} adminRole={adminRole} />

      <RepaymentsAndLiquidations customerId={customerId} />
    </div>
  );
}
