import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

const base = "/user/";

export const getUser = queryOptions({
  queryKey: [base],
  queryFn: async () => {
    const res = await api.get<ApiRes<GetUser>>(base);
    return res.data;
  },
  staleTime: Infinity,
});

export const userOverview = queryOptions({
  queryKey: [base, "overview"],
  queryFn: async () => {
    const res = await api.get<ApiRes<UserDashboardDto>>(`${base}overview`);
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});

export const userActivity = queryOptions({
  queryKey: [base, "recent-activity"],
  queryFn: async () => {
    const res = await api.get<ApiRes<UserActivityDto[]>>(`${base}recent-activity`);
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});

export const userPayroll = queryOptions({
  queryKey: [base, "payroll"],
  queryFn: async () => {
    const res = await api.get<ApiRes<UserPayroll>>(`${base}payroll`);
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});

export const userIdentity = queryOptions({
  queryKey: [base, "identity"],
  queryFn: async () => {
    const res = await api.get<ApiRes<UserIdentityDto>>(`${base}identity`);
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});

export const userPaymentMethod = queryOptions({
  queryKey: [base, "payment-method"],
  queryFn: async () => {
    const res = await api.get<ApiRes<UserPaymentMethodDto>>(`${base}payment-method`);
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});
