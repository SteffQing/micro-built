import React from "react";
import { useQuery } from "@tanstack/react-query";
import { customersOverview } from "@/lib/queries/admin/customers";
import ReportCard from "@/components/report-card";

export const AdminCustomerSectionCards = () => {
  const { data, isLoading } = useQuery(customersOverview);
  return (
    <div className="grid w-full grid-cols-2 gap-2 *:data-[slot=card]:shadow-xs md:grid-cols-3 xl:grid-cols-6">
      <ReportCard
        title="Active Customers"
        value={(data?.data?.activeCustomersCount ?? 0).toString()}
        icon={<div className="absolute bottom-0 right-0 w-12 h-12 bg-secondary rounded-tl-full opacity-80" />}
        className="border-2 border-secondary"
        loading={isLoading}
      />

      <ReportCard
        title="Flagged Customers"
        value={(data?.data?.flaggedCustomersCount ?? 0).toString()}
        icon={<div className="absolute bottom-0 right-0 w-12 h-12 bg-secondary rounded-tl-full opacity-80" />}
        className="border-2 border-secondary"
        loading={isLoading}
      />

      <ReportCard
        title="Customers with Active Loans"
        value={(data?.data?.customersWithActiveLoansCount ?? 0).toString()}
        icon={<div className="absolute bottom-0 right-0 w-12 h-12 bg-secondary rounded-tl-full opacity-80" />}
        className="border-2 border-secondary"
        loading={isLoading}
      />

      <ReportCard
        title="Defaulters"
        value={(data?.data?.defaultedCount ?? 0).toString()}
        icon={<div className="absolute bottom-0 right-0 w-12 h-12 bg-secondary rounded-tl-full opacity-80" />}
        className="border-2 border-secondary"
        loading={isLoading}
      />

      <ReportCard
        title="Repaying on time"
        value={(data?.data?.ontimeCount ?? 0).toString()}
        icon={<div className="absolute bottom-0 right-0 w-12 h-12 bg-secondary rounded-tl-full opacity-80" />}
        className="border-2 border-secondary"
        loading={isLoading}
      />

      <ReportCard
        title="Flagged with Issues"
        value={(data?.data?.flaggedCount ?? 0).toString()}
        icon={<div className="absolute bottom-0 right-0 w-12 h-12 bg-secondary rounded-tl-full opacity-80" />}
        className="border-2 border-secondary"
        loading={isLoading}
      />
    </div>
  );
};
