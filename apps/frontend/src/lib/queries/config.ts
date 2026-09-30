import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

const base = "/config/";

export const getCommodities = queryOptions({
  queryKey: [base, "commodities"],
  queryFn: async () => {
    const res = await api.get<ApiRes<string[]>>(base + "commodities");
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});

export const getConfig = queryOptions({
  queryKey: [base],
  queryFn: async () => {
    const res = await api.get<ApiRes<ConfigData>>(base);
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});
