"use client";

import { useQuery } from "@tanstack/react-query";

import { SiteSubHeader } from "@/components/site-sub-header";
import { customerQuery } from "@/lib/queries/admin/customer";
import GenerateCustomerLoanReport from "../modals/customer-actions/generate-report";
import { CustomerProfileCard, LoanSummary } from "./profile-detail-cards";
import PayrollDataCard from "./payroll-data-card";
import LoansWrapper from "./loans";
import { LiquidationRequestTable, RepaymentHistoryTable } from "./tables";
import { CustomerProfileCardSkeleton } from "./skeletons/profile";

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

      <div className="grid gap-4 lg:grid-cols-3">
        {isLoading || !customer ? (
          <CustomerProfileCardSkeleton />
        ) : (
          <CustomerProfileCard {...customer} adminRole={adminRole} />
        )}
        <LoanSummary id={customerId} name={name} />
        <PayrollDataCard id={customerId} />
      </div>

      <LoansWrapper id={customerId} />

      <RepaymentHistoryTable id={customerId} name={name} />

      <LiquidationRequestTable id={customerId} name={name} />
    </div>
  );
}
