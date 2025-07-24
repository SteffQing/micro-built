import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../utils";

const base = "/user/loan/";

export const allCashLoans = (params: CashLoanQuery = {}) =>
  queryOptions({
    // queryKey: [base, params],
    queryKey: ["all_cashloans"],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<CashLoanItemDto[]>>(`${base}${searchParams}`);
      return res.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

export const userCashLoanQuery = (id: string) =>
  queryOptions({
    queryKey: [base, id],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserCashLoan>>(`${base}${id}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
