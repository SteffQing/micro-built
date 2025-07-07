import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export interface AdminOverview {
  message: string;
  data: {
    activeCount: number;
    pendingCount: number;
    totalDisbursed: number;
    grossProfit: number;
  };
}

export const adminOverviewQueryOption = queryOptions({
  queryKey: ["admin-overview"],
  queryFn: async () => {
    return (await api.get<AdminOverview>("/admin/dashboard")).data;
  },
  staleTime: 20 * 60 * 1000,
});
