import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export interface UserRepymentOverviewResponse {
  data: {
    repaymentsCount: number;
    flaggedRepaymentsCount: number;
    lastRepaymentDate: string;
    nextRepaymentDate: string;
    overdueAmount: number;
  };
  message: string;
}

export const userRepaymentsOverviewOption = queryOptions({
  queryKey: ["user-repayment-overview"],
  queryFn: async () => {
    return (
      await api.get<UserRepymentOverviewResponse>("/user/repayments/overview")
    ).data;
  },
  staleTime: 20 * 60 * 1000,
});

export interface AdminRepymentOverviewResponse {
  data: {
    totalExpected: number;
    totalRepaid: number;
    underpaymentsCount: number;
    failedDeductionsCount: number;
  };
  message: string;
}

export const adminRepaymentsOverviewOption = queryOptions({
  queryKey: ["admin-repayment-overview"],
  queryFn: async () => {
    return (
      await api.get<AdminRepymentOverviewResponse>("/admin/repayments/overview")
    ).data;
  },
  staleTime: 20 * 60 * 1000,
});
