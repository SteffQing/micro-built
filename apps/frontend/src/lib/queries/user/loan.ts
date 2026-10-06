import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

const base = "/user/loan/";

export const allCashLoans = (params: PaginatedApiQuery = {}) =>
  queryOptions({
    queryKey: [base, params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<AllUserLoansDto[]>>(`${base}all${searchParams}`);
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

/** The customer's loans (GET /user/loan), newest first. */
export const userLoans = (params: PaginatedApiQuery & { status?: LoanStatus } = {}) =>
  queryOptions({
    queryKey: [base, "list", params],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserCashLoan[]>>(`${base}${setParams(params)}`);
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

/** Each loan's first payout and its top-ups (GET /user/loan/micro), newest first. */
export const userMicroLoans = (params: PaginatedApiQuery & { status?: MicroLoanStatus } = {}) =>
  queryOptions({
    queryKey: [base, "micro", params],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserMicroLoan[]>>(`${base}micro${setParams(params)}`);
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

/** One micro-loan (a top-up or a loan's payout): what a notification link opens. */
export const userMicroLoan = (id: string) =>
  queryOptions({
    queryKey: [base, "micro", id],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserMicroLoan>>(`${base}micro/${id}`);
      return res.data;
    },
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

export const userCommodityLoanQuery = (id: string) =>
  queryOptions({
    queryKey: [base, "commodity", id],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserCommodityLoan>>(`${base}commodity/${id}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const userLoanOverview = queryOptions({
  queryKey: [base, "overview"],
  queryFn: async () => {
    const res = await api.get<ApiRes<PendingLoanAndLoanCountResponseDto>>(`${base}overview`);
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});

export const allCommodityLoans = (params: PaginatedApiQuery = {}) =>
  queryOptions({
    queryKey: [base, "commodity", params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<UserCommodityLoan[]>>(`${base}commodity${searchParams}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
