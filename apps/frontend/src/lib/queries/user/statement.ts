import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

const base = "/user/statement";

export const userStatement = (params: { from?: string; to?: string; page?: number; limit?: number } = {}) =>
  queryOptions({
    queryKey: [base, params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<UserStatementDto>>(`${base}${searchParams}`);
      return res.data;
    },
    staleTime: 60 * 1000,
  });
