import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export interface AdminCustomersOverview {
  message: string;
  data: {
    activeCustomersCount: number;
    flaggedCustomersCount: number;
    customersWithActiveLoansCount: number;
    defaultedCount: number;
    flaggedCount: number;
    ontimeCount: number;
  };
}

export const adminCustomersOverviewQueryOption = queryOptions({
  queryKey: ["admin-customers-overview"],
  queryFn: async () => {
    return (
      await api.get<AdminCustomersOverview>("/admin/customers/overview")
    ).data;
  },
  staleTime: 20 * 60 * 1000,
});
