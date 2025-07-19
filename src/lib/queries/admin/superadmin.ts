import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export const configData = queryOptions({
  queryKey: ["admin-configs"],
  queryFn: async () => {
    const res = await api.get<ApiRes<ConfigData>>("/config");
    return res.data;
  },
  staleTime: 10 * 60 * 1000,
});

export const adminUsers = queryOptions({
  queryKey: ["/admin"],
  queryFn: async () => {
    const res = await api.get<ApiRes<AdminListDto[]>>("/admin");
    return res.data;
  },
  staleTime: 10 * 60 * 1000,
});
