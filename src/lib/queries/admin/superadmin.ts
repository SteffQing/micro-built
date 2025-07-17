import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export const configData = queryOptions({
  queryKey: ["/config"],
  queryFn: async () => {
    const res = await api.get<ApiRes<ConfigData>>("/config");
    return res.data;
  },
  staleTime: 10 * 60 * 1000, // 10 minutes
});

export const adminUsers = queryOptions({
  queryKey: ["/admin"],
  queryFn: async () => {
    const res = await api.get<ApiRes<AdminListDto[]>>("/admin");
    return res.data;
  },
  staleTime: 10 * 60 * 1000, // 10 minutes
});
