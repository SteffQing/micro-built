import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export interface AdminCustomersListsResponse {
  meta: {
    total: number;
    page: number;
    limit: number;
  };
  data: {
    id: string;
    name: string;
    email: string;
    status: string;
    repaymentRate: number;
  }[];
}

export interface LoanHistoryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "FLAGGED";
}
export const adminCustomersListsQueryOptions = (
  params: LoanHistoryParams = {}
) =>
  queryOptions({
    queryKey: ["admin-customers-lists", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set("page", params.page.toString());
      if (params.limit) searchParams.set("limit", params.limit.toString());

      if (params.search) searchParams.set("search", params.search);
      if (params.status) searchParams.set("status", params.status);

      const url = `/admin/customers${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;
      return (await api.get<AdminCustomersListsResponse>(url)).data;
    },
    staleTime: 20 * 60 * 1000, // 20 minutes
  });
