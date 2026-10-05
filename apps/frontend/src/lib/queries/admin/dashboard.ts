import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export const base = "/admin/dashboard/";

type PeriodRange = { from: string; to: string };
const rangeQuery = (range?: PeriodRange) =>
  range?.from && range?.to ? `?from=${range.from}&to=${range.to}` : "";

export const openLoanRequests = queryOptions({
  queryKey: [base, "open-loan-requests"],
  queryFn: async () => {
    const res = await api.get<ApiRes<OpenLoanRequestsDto>>(base + "open-loan-requests");
    const { error, data } = res.data;
    if (error) throw new Error(error);
    if (!data) throw new Error("Data is undefined or null");
    return data;
  },
  staleTime: 20 * 60 * 1000,
  select: (data) => data,
});

export const customersOverview = queryOptions({
  queryKey: [base, "customers-overview"],
  queryFn: async () => {
    const res = await api.get<ApiRes<CustomersOverviewDto>>(base + "customers-overview");
    const { error, data } = res.data;
    if (error) throw new Error(error);
    if (!data) throw new Error("Data is undefined or null");
    return data;
  },
  staleTime: 20 * 60 * 1000,
});

export const disbursementChart = (range?: PeriodRange) =>
  queryOptions({
    queryKey: [base, "disbursement-chart", range?.from ?? null, range?.to ?? null],
    queryFn: async () => {
      const q = rangeQuery(range);
      const res = await api.get<ApiRes<DisbursementChartEntryDto>>(base + "disbursement-chart" + q);
      const { error, data } = res.data;
      if (error) throw new Error(error);
      if (!data) throw new Error("Data is undefined or null");
      return data;
    },
    staleTime: 20 * 60 * 1000,
  });

export const loanReportOverview = (range?: PeriodRange) =>
  queryOptions({
    queryKey: [base, "loan-report-overview", range?.from ?? null, range?.to ?? null],
    queryFn: async () => {
      const res = await api.get<ApiRes<LoanReportOverviewDto>>(
        base + "loan-report-overview" + rangeQuery(range),
      );
      return res.data;
    },
    staleTime: 20 * 60 * 1000,
  });

export const statusDistribution = queryOptions({
  queryKey: [base, "status-distribution"],
  queryFn: async () => {
    const res = await api.get<ApiRes<LoanReportStatusDistributionDto>>(base + "status-distribution");
    return res.data;
  },
  staleTime: 20 * 60 * 1000,
});

export const dashboardOperations = queryOptions({
  queryKey: [base, "operations"],
  queryFn: async () => {
    const res = await api.get<ApiRes<DashboardOperationsDto>>(base + "operations");
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});

export const overview = (range?: PeriodRange) =>
  queryOptions({
    queryKey: [base, range?.from ?? null, range?.to ?? null],
    queryFn: async () => {
      const res = await api.get<ApiRes<DashboardOverviewDto>>(
        base + rangeQuery(range),
      );
      return res.data;
    },
    staleTime: 20 * 60 * 1000,
  });
