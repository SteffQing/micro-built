import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

const base = "/user/repayments/";

export const userRepaymentsOverview = queryOptions({
  queryKey: [base, "overview"],
  queryFn: async () => {
    const res = await api.get<ApiRes<UserRepaymentOverviewDto>>(`${base}overview`);
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});

export const userRepaymentsHistory = (params: UserRepaymentsQuery) =>
  queryOptions({
    queryKey: [base, "history", params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<UserRepaymentHistoryDto[]>>(`${base}history${searchParams}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const userRepaymentsChart = (year: number = new Date().getFullYear()) =>
  queryOptions({
    queryKey: [base, year],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserRepaymentChartDto[]>>(`${base}?year=${year}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const getUserRepaymentInfo = (id: string) =>
  queryOptions({
    queryKey: [base, id],
    queryFn: async () => {
      const res = await api.get<ApiRes<SingleUserRepaymentDto>>(`${base}${id}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
