import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

const base = "/admin/customer/";

export const customerQuery = (id: string) =>
  queryOptions({
    queryKey: [base, id],
    queryFn: async () => {
      const res = await api.get<ApiRes<CustomerInfoDto>>(base + id);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const customerLoans = (id: string) =>
  queryOptions({
    queryKey: [base, id, "loans"],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserLoansDto>>(`${base}${id}/loans`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const customerLoanSummary = (id: string) =>
  queryOptions({
    queryKey: [base, id, "summary"],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserLoanSummaryDto>>(`${base}${id}/summary`);

      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const customerRepayments = (id: string, params: CustomerQuery = {}) =>
  queryOptions({
    queryKey: [base, id, "repayments", params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<UserRepaymentHistory[]>>(`${base}${id}/repayments${searchParams}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
