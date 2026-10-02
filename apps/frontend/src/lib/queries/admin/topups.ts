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
