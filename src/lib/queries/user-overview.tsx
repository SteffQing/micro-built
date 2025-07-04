import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export interface UserOverview {
  activeLoanAmount: number;
  activeLoanRepaid: number;
  lastDeduction: string | null;
  nextRepaymentDate: string | null;
  overdueLoansCount: number;
  pendingLoanRequestsCount: number;
}

export const userOverviewQuery = queryOptions({
  queryKey: ["user-overview"],
  queryFn: async () => {
    return (await api.get<UserOverview>("/user/overview")).data;
  },
  staleTime: 20 * 60 * 1000, // 20 minutes
});
