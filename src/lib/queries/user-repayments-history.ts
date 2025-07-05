import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import type { LoanCategory, LoanStatus } from "./query-types";

export interface UserRepaymentsHistory {
  meta: {
    total: number;
    page: number;
    limit: number;
  };
  data: {
    id: string;
    repaid: number;
    period: string;
    loanId: string;
    date: string;
  }[];
}

export interface LoanHistoryParams {
  page?: number;
  limit?: number;
}
export const userRepaymentsHistoryQueryOptions = (
  params: LoanHistoryParams = {}
) =>
  queryOptions({
    queryKey: ["user-loan-request-history", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set("page", params.page.toString());
      if (params.limit) searchParams.set("limit", params.limit.toString());

      const url = `/user/repayments/history${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;
      return (await api.get<UserRepaymentsHistory>(url)).data;
    },
    staleTime: 20 * 60 * 1000, // 20 minutes
  });
