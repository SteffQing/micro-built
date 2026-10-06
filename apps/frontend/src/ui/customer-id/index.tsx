"use client";

import { useQuery } from "@tanstack/react-query";

import { SiteSubHeader } from "@/components/site-sub-header";
import { customerQuery } from "@/lib/queries/admin/customer";
import GenerateCustomerLoanReport from "../modals/customer-actions/generate-report";
import { CustomerProfileCard, LoanSummary } from "./profile-detail-cards";
import CustomerDetailsCard from "./customer-details-card";
import LoansWrapper from "./loans";
import DeductionsAndPayments from "./deductions-payments";
import { CustomerProfileCardSkeleton } from "./skeletons/profile";
import LoanChanges from "./loan-changes";
import { CustomerPendingChanges } from "./pending-changes-notice";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        rightContent={<GenerateCustomerLoanReport id={customerId} email={customer?.email ?? null} />}
      />

      <CustomerPendingChanges customerId={customerId} />

      {/* Profile beside a wide (4x2) loan summary so the two end at the same height; details get their own
          full-width row instead of a sparse third column. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(300px,1fr)_minmax(0,2fr)] *:min-w-0">
        {isLoading || !customer ? (
          <CustomerProfileCardSkeleton />
        ) : (
          <CustomerProfileCard {...customer} adminRole={adminRole} />
        )}
        <LoanSummary id={customerId} name={name} />
      </div>

      <CustomerDetailsCard id={customerId} name={name} />

      {/* Everything about the customer's money, one area at a time instead of a long scroll. */}
      <Tabs defaultValue="loans" className="gap-4">
        <div className="max-w-full overflow-x-auto">
          <TabsList className="bg-card">
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="changes">Loan Changes</TabsTrigger>
            <TabsTrigger value="payments">Deductions &amp; Payments</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="loans" className="mt-0">
          <LoansWrapper id={customerId} name={name} />
        </TabsContent>
        <TabsContent value="changes" className="mt-0">
          <LoanChanges customerId={customerId} adminRole={adminRole} />
        </TabsContent>
        <TabsContent value="payments" className="mt-0">
          <DeductionsAndPayments customerId={customerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
