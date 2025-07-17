import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../utils";

const base = "/admin/loans/cash/";

export const allCashLoans = (params: CashLoanQuery = {}) =>
  queryOptions({
    queryKey: [base, params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<CashLoanItemDto[]>>(
        `${base}${searchParams}`
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const cashLoanQuery = (id: string) =>
  queryOptions({
    queryKey: [base, id],
    queryFn: async () => {
      const res = await api.get<ApiRes<CashLoan>>(`${base}${id}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
