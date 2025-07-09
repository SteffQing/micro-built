import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export interface AdminCustomersByIdResponse {
  data: {
    id: string;
    name: string;
    email: string;
    status: string;
    contact: string;
    avatar: string | null;
  };
  message: string;
}

export interface AdminCustomersByIdParams {
  id: string;
}

export const adminCustomerByIdQueryOptions = (
  params: AdminCustomersByIdParams
) => {
  const queryKey = [
    "admin-customers-id",
    {
      id: params.id,
    },
  ];

  return queryOptions({
    queryKey: queryKey,
    queryFn: async () => {
      const url = `/admin/customer/${params.id}`;
      return (await api.get<AdminCustomersByIdResponse>(url)).data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

export interface AdminCustomersLoanSummaryByIdResponse {
  data: {
    totalBorrowed: number;
    totalOutstanding: number;
    defaultedRepaymentsCount: number;
    flaggedRepaymentsCount: number;
  };
  message: string;
}

export const adminCustomerLoanSummaryByIdQueryOptions = (
  params: AdminCustomersByIdParams
) => {
  const queryKey = [
    "admin-customers-loan-summary-id",
    {
      id: params.id,
    },
  ];

  return queryOptions({
    queryKey: queryKey,
    queryFn: async () => {
      const url = `/admin/customer/${params.id}/loan-summary`;
      return (await api.get<AdminCustomersLoanSummaryByIdResponse>(url)).data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};
