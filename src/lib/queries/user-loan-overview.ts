import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export interface UserLoanOverview {
  pendingLoans: {
    amount: number;
    id: string;
    date: string;
  }[];
  rejectedLoans: number;
  approvedLoans: number;
  disbursedLoans: number;
}

export const userLoanOverviewQuery = queryOptions({
  queryKey: ["user-loan-overview"],
  queryFn: async () => {
    return (await api.get<UserLoanOverview>("/user/loan/overview")).data;
  },
  staleTime: 20 * 60 * 1000, // 20 minutes
});
