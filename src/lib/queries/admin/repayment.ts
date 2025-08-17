import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

const base = "/admin/repayments/";

export const repaymentsOverview = queryOptions({
  queryKey: [base, "overview"],
  queryFn: async () => {
    const res = await api.get<ApiRes<RepaymentOverviewDto>>(base + "overview");
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});

export const allRepayments = (params: FilterRepayments = {}) =>
  queryOptions({
    queryKey: [base, params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<RepaymentsHistoryDto[]>>(`${base}${searchParams}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const getRepaymentInfo = (id: string) =>
  queryOptions({
    queryKey: [base, id],
    queryFn: async () => {
      const res = await api.get<ApiRes<SingleRepaymentWithUserDto>>(`${base}${id}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
