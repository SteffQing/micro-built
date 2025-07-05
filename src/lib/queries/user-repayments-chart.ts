import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export interface UserRepaymentsHistoryForCharts {
  data: {
    month: string;
    repaid: number;
  }[];
}

export const userRepaymentsHistoryQueryForChartsOptions = (
  params: { year?: string } = { year: "2025" }
) =>
  queryOptions({
    queryKey: ["user-repayments-history-forcharts", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.year) searchParams.set("year", params.year.toString());

      const url = `/user/repayments${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;
      return (await api.get<UserRepaymentsHistoryForCharts>(url)).data;
    },
    staleTime: 20 * 60 * 1000, // 20 minutes
  });
