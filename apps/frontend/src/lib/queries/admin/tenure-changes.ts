import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

const base = "/admin/tenure-changes";

export { base };

export const adminTenureChanges = (params: { status?: TenureChangeStatus; page?: number; limit?: number } = {}) =>
  queryOptions({
    queryKey: [base, params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<AdminTenureChangeDto[]>>(`${base}${searchParams}`);
      return res.data;
    },
    staleTime: 30 * 1000,
  });
