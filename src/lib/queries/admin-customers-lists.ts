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
) => {
  const stableParams = Object.fromEntries(
    Object.entries(params).filter(([_, value]) => {
      console.log("dkd", _);
      return value !== undefined;
    })
  );

  const queryKey = [
    "admin-customers-lists",
    {
      page: params.page || 1,
      limit: params.limit || 20,
      ...(params.search && { search: params.search }),
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

      if (params.search?.trim()) {
        searchParams.set("search", params.search.trim());
      }
      if (params.status) {
        searchParams.set("status", params.status);
      }

      const url = `/admin/customers?${searchParams.toString()}`;
      console.log("API Request URL:", url);
      console.log({ searchParams });
      return (await api.get<AdminCustomersListsResponse>(url)).data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};
