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
      const res = await api.get<ApiRes<UserLoanSummaryDto>>(
        `${base}${id}/summary`,
      );
      return res.data;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 15 * 1000,
  });

export const customerLiquidations = (
  id: string,
  params: CustomerLiquidationsQuery = {},
) =>
  queryOptions({
    queryKey: [base, id, "liquidation-requests", params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<CustomerLiquidationsRequestDto[]>>(
        `${base}${id}/liquidation-requests${searchParams}`,
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const adminLiquidationProof = (customerId: string, requestId: string) =>
  queryOptions({
    queryKey: [base, customerId, "liquidation-requests", requestId, "proof"],
    queryFn: async () => {
      const res = await api.get<ApiRes<{ url: string; expiresIn: number }>>(
        `${base}${customerId}/liquidation-requests/${requestId}/proof`,
      );
      return res.data;
    },
    staleTime: 0,
  });

export const customerRepayments = (id: string, params: CustomerRepaymentsQuery = {}) =>
  queryOptions({
    queryKey: [base, id, "repayments", params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<RepaymentsHistoryDto[]>>(
        `${base}${id}/repayments${searchParams}`,
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const customerTopups = (
  id: string,
  params: CustomerTopupHistoryQuery = {},
) =>
  queryOptions({
    queryKey: [base, id, "topups", params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<CustomerTopupHistoryDto[]>>(
        `${base}${id}/topups${searchParams}`,
      );
      return res.data;
    },
    staleTime: 60 * 1000,
  });

export const customerTenureChanges = (
  id: string,
  params: CustomerTenureChangeQuery = {},
) =>
  queryOptions({
    queryKey: [base, id, "tenure-changes", params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<CustomerTenureChangeHistoryDto[]>>(
        `${base}${id}/tenure-changes${searchParams}`,
      );
      return res.data;
    },
    staleTime: 60 * 1000,
  });

export const customerLoanStatement = (
  id: string,
  params: CustomerLoanStatementQuery = {},
) =>
  queryOptions({
    queryKey: [base, id, "loan-statement", params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<LoanStatementDto>>(
        `${base}${id}/loan-statement${searchParams}`,
      );
      return res.data;
    },
    staleTime: 60 * 1000,
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
    queryKey: [base, id, "payroll"],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserPayroll | null>>(`${base}${id}/payroll`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const customerIdentity = (id: string) =>
  queryOptions({
    queryKey: [base, id, "identity"],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserIdentityDto | null>>(
        `${base}${id}/identity`,
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const customerPaymentMethod = (id: string) =>
  queryOptions({
    queryKey: [base, id, "payment-method"],
    queryFn: async () => {
      const res = await api.get<ApiRes<UserPaymentMethodDto | null>>(
        `${base}${id}/payment-method`,
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const getUserActiveLoan = (id: string) =>
  queryOptions({
    queryKey: [base, id, "active-loan"],
    queryFn: async () => {
      const response = await api.get<ApiRes<(LoanFigures & {
        id: string;
        category: LoanCategory;
        status: LoanStatus;
        disbursementDate: string | null;
      }) | null>>(
        `${base}${id}/active-loan`,
      );
      return response.data;
    },
  });

export const customerReportPreview = (id: string, params: { audience: "admin" | "customer"; from?: string; to?: string }) =>
  queryOptions({
    queryKey: [base, id, "report-preview", params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<CustomerReportPreviewDto>>(
        `${base}${id}/report-preview${searchParams}`,
      );
      return res.data;
    },
    staleTime: 60 * 1000,
  });
