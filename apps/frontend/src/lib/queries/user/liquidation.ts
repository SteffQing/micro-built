import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

const base = "/user";

export const liquidationPreview = queryOptions({
  queryKey: [base, "liquidation-preview"],
  queryFn: async () => {
    const res = await api.get<ApiRes<LiquidationPreviewDto>>(`${base}/loan/liquidation-preview`);
    return res.data;
  },
  staleTime: 60 * 1000,
});

export const userLiquidations = (params: PaginatedApiQuery & { state?: string } = {}) =>
  queryOptions({
    queryKey: [base, "liquidations", params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<UserLiquidationDto[]>>(`${base}/repayments/liquidations${searchParams}`);
      return res.data;
    },
    staleTime: 60 * 1000,
  });

export const userLiquidationProof = (id: string) =>
  queryOptions({
    queryKey: [base, "liquidations", id, "proof"],
    queryFn: async () => {
      const res = await api.get<ApiRes<{ url: string; expiresIn: number }>>(`${base}/repayments/liquidations/${id}/proof`);
      return res.data;
    },
    staleTime: 0,
  });
