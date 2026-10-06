import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

const base = "/admin/loans/topups";

export { base };

export const adminTopups = (params: { status?: string; page?: number; limit?: number } = {}) =>
  queryOptions({
    queryKey: [base, params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<AdminTopupDto[]>>(`${base}${searchParams}`);
      return res.data;
    },
    staleTime: 30 * 1000,
  });

export const adminTopup = (id: string) =>
  queryOptions({
    queryKey: [base, id],
    queryFn: async () => {
      const res = await api.get<ApiRes<AdminTopupDto>>(`${base}/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
  });
