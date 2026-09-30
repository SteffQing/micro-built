import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

const base = "/admin/loans/commodity/";

export const allCommodityLoans = (params: CommodityLoanQuery = {}) =>
  queryOptions({
    queryKey: [base, params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<CommodityLoanItemDto[]>>(`${base}${searchParams}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const commodityLoanQuery = (id: string) =>
  queryOptions({
    queryKey: [base, id],
    queryFn: async () => {
      const res = await api.get<ApiRes<CommodityLoanDto>>(`${base}${id}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
