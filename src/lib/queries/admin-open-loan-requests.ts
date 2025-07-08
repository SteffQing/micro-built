import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export interface OpenLoanRequests {
  message: string;
  data: {
    cashLoans: {
      customerId: string;
      id: string;
      amount: number;
      category: string;
      requestedAt: string;
    }[];
    commodityLoans: {
      customerId: string;
      id: string;
      name: string;
      category: string;
      requestedAt: string;
    }[];
  };
}

export const adminOpenLoanRequestsQueryOption = queryOptions({
  queryKey: ["admin-open-loan-requests"],
  queryFn: async () => {
    return (
      await api.get<OpenLoanRequests>("/admin/dashboard/open-loan-requests")
    ).data;
  },
  staleTime: 20 * 60 * 1000,
});
