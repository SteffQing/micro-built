import React from "react";
import { useQuery } from "@tanstack/react-query";
import { accountOfficerStats } from "@/lib/queries/admin/account-officer";
import ReportCard from "@/components/report-card";
import { formatCurrency } from "@/lib/utils";

interface Props {
  officerId: string;
}

export const AccountOfficerStatsCards = ({ officerId }: Props) => {
  const { data, isLoading } = useQuery(accountOfficerStats(officerId));

  return (
    <div className="grid grid-cols-1 gap-2 justify-between w-full *:data-[slot=card]:shadow-xs @xl/main:grid-cols-4 @5xl/main:grid-cols-5">
      <ReportCard
        title="Total Customers"
        value={(data?.data?.customers?.total ?? 0).toString()}
        icon={
          <div className="absolute bottom-0 right-0 w-12 h-12 bg-primary/10 rounded-tl-full opacity-80" />
        }
        className="border-2 border-primary/10"
        loading={isLoading}
      />

      <ReportCard
        title="Active Customers"
        value={(data?.data?.customers?.active ?? 0).toString()}
        icon={
          <div className="absolute bottom-0 right-0 w-12 h-12 bg-green-50 rounded-tl-full opacity-80" />
        }
        className="border-2 border-green-100"
        loading={isLoading}
      />

      <ReportCard
        title="Inactive Customers"
        value={(data?.data?.customers?.inactive ?? 0).toString()}
        icon={
          <div className="absolute bottom-0 right-0 w-12 h-12 bg-gray-100 rounded-tl-full opacity-80" />
        }
        className="border-2 border-gray-100"
        loading={isLoading}
      />

      <ReportCard
        title="Flagged Customers"
        value={(data?.data?.customers?.flagged ?? 0).toString()}
        icon={
          <div className="absolute bottom-0 right-0 w-12 h-12 bg-orange-50 rounded-tl-full opacity-80" />
        }
        className="border-2 border-orange-100"
        loading={isLoading}
      />

      <ReportCard
        title="Avg. Repayment Score"
        value={(data?.data?.customers?.avgRepaymentScore ?? 0).toString() + "%"}
        icon={
          <div className="absolute bottom-0 right-0 w-12 h-12 bg-purple-50 rounded-tl-full opacity-80" />
        }
        className="border-2 border-purple-100"
        loading={isLoading}
      />

      <ReportCard
        title="Total Loans"
        value={(data?.data?.portfolio?.totalLoans ?? 0).toString()}
        icon={
          <div className="absolute bottom-0 right-0 w-12 h-12 bg-indigo-50 rounded-tl-full opacity-80" />
        }
        className="border-2 border-indigo-100"
        loading={isLoading}
      />

      <ReportCard
        title="Total Disbursed"
        value={formatCurrency(data?.data?.portfolio?.totalDisbursed ?? 0)}
        icon={
          <div className="absolute bottom-0 right-0 w-12 h-12 bg-blue-50 rounded-tl-full opacity-80" />
        }
        className="border-2 border-blue-100"
        loading={isLoading}
      />

      <ReportCard
        title="Total Repaid"
        value={formatCurrency(data?.data?.portfolio?.totalRepaid ?? 0)}
        icon={
          <div className="absolute bottom-0 right-0 w-12 h-12 bg-teal-50 rounded-tl-full opacity-80" />
        }
        className="border-2 border-teal-100"
        loading={isLoading}
      />

      <ReportCard
        title="Outstanding Balance"
        value={formatCurrency(data?.data?.portfolio?.outstandingBalance ?? 0)}
        icon={
          <div className="absolute bottom-0 right-0 w-12 h-12 bg-red-50 rounded-tl-full opacity-80" />
        }
        className="border-2 border-red-100"
        loading={isLoading}
      />

      <ReportCard
        title="Total Penalty"
        value={formatCurrency(data?.data?.portfolio?.totalPenalty ?? 0)}
        icon={
          <div className="absolute bottom-0 right-0 w-12 h-12 bg-rose-50 rounded-tl-full opacity-80" />
        }
        className="border-2 border-rose-100"
        loading={isLoading}
      />
    </div>
  );
};
