import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

const base = "/admin/commodities";

export const allCommodities = queryOptions({
  queryKey: [base],
  queryFn: async () => {
    const res = await api.get<ApiRes<CommodityItem[]>>(base);
    const { error, data } = res.data;
    if (error) throw new Error(error);
    if (!data) throw new Error("Data is undefined or null");
    return data;
  },
  staleTime: 5 * 60 * 1000,
});
