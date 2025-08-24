import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

export const base = "/admin/customer/";

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
      console.log(res);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const customerRepayments = (id: string, params: CustomerQuery = {}) =>
  queryOptions({
    queryKey: [base, id, "repayments", params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<RepaymentsHistoryDto[]>>(`${base}${id}/repayments${searchParams}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const customerPPI = (id: string) =>
  queryOptions({
    queryKey: [base, id, "ppi-info"],
    queryFn: async () => {
      const res = await api.get<ApiRes<CustomerPPI>>(`${base}${id}/ppi-info`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const customerPayroll = (id: string) =>
  queryOptions({
    queryKey: [base, "payroll"],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserPayroll>>(`${base}${id}/payroll`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const customerIdentity = (id: string) =>
  queryOptions({
    queryKey: [base, "identity"],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserIdentityDto>>(`${base}${id}/identity`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const customerPaymentMethod = (id: string) =>
  queryOptions({
    queryKey: [base, "payment-method"],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserPaymentMethodDto>>(`${base}${id}/payment-method`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
