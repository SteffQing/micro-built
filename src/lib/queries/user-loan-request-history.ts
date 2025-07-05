import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export interface UserLoanRequestHistory {
  meta: {
    total: number;
    page: string;
    limit: string;
  };
  data: {
    id: string;
    amount: number;
    status:
      | "PENDING"
      | "PREVIEW"
      | "REJECTED"
      | "ACCEPTED"
      | "APPROVED"
      | "DISBURSED"
      | "REPAID";
    category:
      | "EDUCATION"
      | "PERSONAL"
      | "BUSINESS"
      | "MEDICAL"
      | "RENT"
      | "TRAVEL"
      | "AGRICULTURE"
      | "UTILITIES"
      | "EMERGENCY"
      | "OTHERS"
      | "ASSET_PURCHASE";
    date: string;
  }[];
}

export interface LoanHistoryParams {
  page?: number;
  limit?: number;
}
export const userLoanRequestHistoryQueryOptions = (params: LoanHistoryParams = {}) =>
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
