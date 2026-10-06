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
    const res = await api.get<ApiRes<UserPayrollDto | null>>(`${base}payroll`);
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});

export const userIdentity = queryOptions({
  queryKey: [base, "identity"],
  queryFn: async () => {
    const res = await api.get<ApiRes<UserIdentityDto | null>>(`${base}identity`);
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});

export const userPaymentMethod = queryOptions({
  queryKey: [base, "payment-method"],
  queryFn: async () => {
    const res = await api.get<ApiRes<UserPaymentMethodDto | null>>(`${base}payment-method`);
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});

/** The signed-in user's pending change requests (identity, payment method, profile). */
export const userPendingChanges = queryOptions({
  queryKey: [base, "change-requests", "PENDING"],
  queryFn: async () => {
    const res = await api.get<ApiRes<ChangeRequestDto[]>>(`${base}change-requests?status=PENDING&limit=10`);
    return res.data;
  },
  staleTime: 60 * 1000,
});

/** The signed-in user's latest change requests in any state; the settings screens show the decided ones. */
export const userRecentChanges = queryOptions({
  queryKey: [base, "change-requests", "recent"],
  queryFn: async () => {
    const res = await api.get<ApiRes<ChangeRequestDto[]>>(`${base}change-requests?limit=20`);
    return res.data;
  },
  staleTime: 60 * 1000,
});
