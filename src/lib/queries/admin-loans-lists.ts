import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { LoanStatus } from "./query-types";

export interface AdminCashLoansListsResponse {
  meta: {
    total: number;
    page: number;
    limit: number;
  };
  data: {
    id: string;
    date: string;
    amount: number;
    customerId: string;
    category: string;
    loanTenure: number;
    status: LoanStatus;
  }[];
  message: string;
}

export interface AdminCashLoansListsParams {
  page?: number;
  limit?: number;
  status?: LoanStatus;
}
export const adminCashLoansListsQueryOptions = (
  params: AdminCashLoansListsParams = {}
) => {
  const stableParams = Object.fromEntries(
    Object.entries(params).filter(([_, value]) => {
      console.log("dkd", _);
      return value !== undefined;
    })
  );

  const queryKey = [
    "admin-cash-loans-lists",
    {
      page: params.page || 1,
      limit: params.limit || 20,
      ...(params.status && { status: params.status }),
    },
  ];
  console.log("Creating query with params:", stableParams);

  return queryOptions({
    queryKey: queryKey,
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      const page = Math.max(1, params.page || 1);
      const limit = Math.max(1, params.limit || 20);

      searchParams.set("page", page.toString());
      searchParams.set("limit", limit.toString());

      if (params.status) {
        searchParams.set("status", params.status);
      }

      const url = `/admin/loans/cash?${searchParams.toString()}`;
      console.log("API Request URL:", url);
      console.log({ searchParams });
      return (await api.get<AdminCashLoansListsResponse>(url)).data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};
