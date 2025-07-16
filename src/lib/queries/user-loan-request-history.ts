import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { LoanCategory, LoanStatus } from "./query-types";

export interface UserLoanRequestHistory {
  meta: {
    total: number;
    page: string;
    limit: string;
  };
  data: {
    loans: {
      id: string;
      amount: number;
      status: LoanStatus;
      category: LoanCategory;
      date: string;
    }[];
  };
}

export interface LoanHistoryParams {
  page?: number;
  limit?: number;
}
export const userLoanRequestHistoryQueryOptions = (
  params: LoanHistoryParams = {}
) =>
  queryOptions({
    queryKey: ["user-loan-request-history", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set("page", params.page.toString());
      if (params.limit) searchParams.set("limit", params.limit.toString());

      const url = `/user/loan/history${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;
      return (await api.get<UserLoanRequestHistory>(url)).data;
    },
    staleTime: 20 * 60 * 1000, // 20 minutes
  });
