import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

const base = "/admin/dashboard/";

type DateRange = { from: string; to: string };
const rangeQuery = (range?: DateRange) =>
  range?.from && range?.to ? `?from=${range.from}&to=${range.to}` : "";

export const openLoanRequests = queryOptions({
  queryKey: [base, "open-loan-requests"],
  queryFn: async () => {
    const openLoanRequestsData = await api.get<ApiRes<OpenLoanRequestsDto>>(base + "open-loan-requests");

    const { error, data } = openLoanRequestsData.data;

    if (error) throw new Error(error);
    if (!data) throw new Error("Data is undefined or null");

    return data;
  },
  staleTime: 20 * 60 * 1000,
  select: (data) => {
    const { cashLoans, commodityLoans } = data;
    return [...cashLoans, ...commodityLoans];
  },
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

export const disbursementChart = (year?: string) =>
  queryOptions({
    queryKey: [base, "disbursement-chart", year],
    queryFn: async () => {
      const q = year ? `?year=${year}` : "";
      const res = await api.get<ApiRes<DisbursementChartEntryDto>>(base + "disbursement-chart" + q);
      const { error, data } = res.data;
      if (error) throw new Error(error);
      if (!data) throw new Error("Data is undefined or null");
      return data;
    },
    staleTime: 20 * 60 * 1000,
  });

export const loanReportOverview = (range?: DateRange) =>
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

export const overview = (range?: DateRange) =>
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
