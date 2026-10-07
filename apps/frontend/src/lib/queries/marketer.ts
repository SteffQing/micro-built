import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../utils";

// A marketer's own work (GET /marketer/*): only the customers they onboarded.
export const marketerBase = "/marketer/";

export const marketerOverview = queryOptions({
  queryKey: [marketerBase, "overview"],
  queryFn: async () => (await api.get<ApiRes<MarketerOverviewDto>>(`${marketerBase}overview`)).data,
  staleTime: 60 * 1000,
});

export const marketerLoans = (params: CashLoanQuery = {}) =>
  queryOptions({
    queryKey: [marketerBase, "loans", params],
    queryFn: async () =>
      (await api.get<ApiRes<MarketerCashLoanItemDto[]>>(`${marketerBase}loans${setParams(params)}`)).data,
    staleTime: 60 * 1000,
  });

export const marketerLoan = (id: string) =>
  queryOptions({
    queryKey: [marketerBase, "loans", id],
    queryFn: async () => (await api.get<ApiRes<CashLoan>>(`${marketerBase}loans/${id}`)).data,
    enabled: Boolean(id),
  });

export const marketerAssetRequests = (params: CommodityLoanQuery = {}) =>
  queryOptions({
    queryKey: [marketerBase, "asset-requests", params],
    queryFn: async () =>
      (await api.get<ApiRes<MarketerAssetRequestItemDto[]>>(`${marketerBase}asset-requests${setParams(params)}`)).data,
    staleTime: 60 * 1000,
  });

export const marketerAssetRequest = (id: string) =>
  queryOptions({
    queryKey: [marketerBase, "asset-requests", id],
    queryFn: async () => (await api.get<ApiRes<CommodityLoanDto>>(`${marketerBase}asset-requests/${id}`)).data,
    enabled: Boolean(id),
  });

export const marketerTopups = (params: { status?: string; page?: number; limit?: number } = {}) =>
  queryOptions({
    queryKey: [marketerBase, "topups", params],
    queryFn: async () =>
      (await api.get<ApiRes<MarketerTopupItemDto[]>>(`${marketerBase}topups${setParams(params)}`)).data,
    staleTime: 60 * 1000,
  });

export const marketerTopup = (id: string) =>
  queryOptions({
    queryKey: [marketerBase, "topups", id],
    queryFn: async () => (await api.get<ApiRes<AdminTopupDto>>(`${marketerBase}topups/${id}`)).data,
    enabled: Boolean(id),
  });

/** One payroll month; without `period`, the latest month the marketer's customers had deductions in. */
export const marketerRepaymentOverview = (period?: string) =>
  queryOptions({
    queryKey: [marketerBase, "repayments", "overview", period ?? null],
    queryFn: async () =>
      (
        await api.get<ApiRes<MarketerRepaymentOverviewDto>>(
          `${marketerBase}repayments/overview${setParams(period ? { period } : {})}`,
        )
      ).data,
    staleTime: 60 * 1000,
  });

export const marketerDeductions = (params: FilterDeductions = {}) =>
  queryOptions({
    queryKey: [marketerBase, "repayments", "deductions", params],
    queryFn: async () =>
      (await api.get<ApiRes<DeductionListItemDto[]>>(`${marketerBase}repayments/deductions${setParams(params)}`)).data,
    staleTime: 60 * 1000,
  });

export const marketerAdmins = queryOptions({
  queryKey: [marketerBase, "admins"],
  queryFn: async () => (await api.get<ApiRes<MarketerAdminDto[]>>(`${marketerBase}admins`)).data,
  staleTime: 5 * 60 * 1000,
});
