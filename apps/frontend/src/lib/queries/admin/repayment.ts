import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

const base = "/admin/repayments/";

type PeriodRange = { from: string; to: string };

export const repaymentsOverview = (range?: PeriodRange) =>
  queryOptions({
    queryKey: [base, "overview", range?.from ?? null, range?.to ?? null],
    queryFn: async () => {
      const q = range?.from && range?.to ? `?from=${range.from}&to=${range.to}` : "";
      const res = await api.get<ApiRes<RepaymentOverviewDto>>(base + "overview" + q);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const allRepayments = (params: FilterRepayments = {}) =>
  queryOptions({
    queryKey: [base, params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<RepaymentsHistoryDto[]>>(
        `${base}${searchParams}`
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const getRepaymentInfo = (id: string) =>
  queryOptions({
    queryKey: [base, id],
    queryFn: async () => {
      const res = await api.get<ApiRes<SingleRepaymentWithUserDto>>(
        `${base}${id}`
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const getRepaymentProof = (id: string) =>
  queryOptions({
    queryKey: [base, id, "proof"],
    queryFn: async () => {
      const res = await api.get<ApiRes<{ url: string; expiresIn: number }>>(
        `${base}${id}/proof`
      );
      return res.data;
    },
    staleTime: 0,
  });

// Keys start with `base`, so every `invalidateQueries({ queryKey: [base] })` (upload, close-period,
// resolve, liquidation decisions) refreshes these lists too.
export const deductionsList = (params: FilterDeductions = {}) =>
  queryOptions({
    queryKey: [base, "deductions", params],
    queryFn: async () => {
      const res = await api.get<ApiRes<DeductionListItemDto[]>>(
        `${base}deductions${setParams(params)}`
      );
      return res.data;
    },
    staleTime: 60 * 1000,
  });

export const appliedRepayments = (params: FilterAppliedRepayments = {}) =>
  queryOptions({
    queryKey: [base, "applied", params],
    queryFn: async () => {
      const res = await api.get<ApiRes<AppliedRepaymentListItemDto[]>>(
        `${base}applied${setParams(params)}`
      );
      return res.data;
    },
    staleTime: 60 * 1000,
  });
