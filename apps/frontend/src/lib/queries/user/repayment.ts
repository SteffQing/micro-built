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

export const userRepaymentsList = (params: UserRepaymentsQuery = {}) =>
  queryOptions({
    queryKey: [base, params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<UserRepaymentHistoryDto[]>>(`${base}${searchParams}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const userRepaymentsHistory = (params: UserRepaymentsHistoryQuery = {}) =>
  queryOptions({
    queryKey: [base, "history", params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<UserRepaymentHistoryDto[]>>(`${base}history${searchParams}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const userRepaymentsChart = () =>
  queryOptions({
    queryKey: [base, "chart"],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserRepaymentChartDto[]>>(`${base}chart`);
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

export const userDeductions = (params: { page?: number; limit?: number } = {}) =>
  queryOptions({
    queryKey: [base, "deductions", params],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserDeductionDto[]>>(`${base}deductions${setParams(params)}`);
      return res.data;
    },
  });

export const userInflows = (params: { page?: number; limit?: number; source?: PaymentInflowSource } = {}) =>
  queryOptions({
    queryKey: [base, "inflows", params],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserInflowDto[]>>(`${base}inflows${setParams(params)}`);
      return res.data;
    },
  });
