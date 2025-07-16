import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

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
      return (await api.get<ApiRes<CustomerInfoDto>>(url)).data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

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
      return (await api.get<ApiRes<UserLoanSummaryDto>>(url)).data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const adminCustomerLoansDetailsByIdQueryOptions = (
  params: AdminCustomersByIdParams
) => {
  const queryKey = [
    "admin-customers-loans-details-id",
    {
      id: params.id,
    },
  ];

  return queryOptions({
    queryKey: queryKey,
    queryFn: async () => {
      const url = `/admin/customer/${params.id}/loans`;
      return (await api.get<ApiRes<UserLoansDto>>(url)).data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

export interface AdminCustomersRepaymentHistoryByIdResponse {
  data: {
    id: string;
    repaid: number;
    period: string;
    date: string;
    loanId: string;
  }[];
  message: string;
}

export interface AdminCustomersRepaymentHistoryByIdParams {
  id: string;
  page: number;
  limit: number;
  total: number;
}
export const adminCustomerRepaymentHistoryByIdQueryOptions = (
  params: AdminCustomersRepaymentHistoryByIdParams
) => {
  const queryKey = [
    "admin-customers-repayment-history-id",
    {
      id: params.id,
      page: params.page,
      limit: params.limit,
      total: params.total,
    },
  ];
  const searchParams = new URLSearchParams();
  searchParams.set("page", params.page.toString());
  searchParams.set("limit", params.limit.toString());
  searchParams.set("total", params.total.toString());

  return queryOptions({
    queryKey: queryKey,
    queryFn: async () => {
      const url = `/admin/customer/${params.id}/repayments${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;
      return (await api.get<AdminCustomersRepaymentHistoryByIdResponse>(url))
        .data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};
