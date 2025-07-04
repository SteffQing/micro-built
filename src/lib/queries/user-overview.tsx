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
  queryFn: async (): Promise<UserOverview> => {
    const response = await api.get<{ data: UserOverview }>("/user/overview");
    return response.data.data;
  },
  staleTime: 20 * 60 * 1000, // 20 minutes
});

