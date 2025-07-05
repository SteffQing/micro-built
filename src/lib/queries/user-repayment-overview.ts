import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
export interface UserRecentActivity {
  title: string;
  description: string;
  date: string;
  source: string;
}

export const userRepaymentsOverviewOption = queryOptions({
  queryKey: ["user-recent-activities"],
  queryFn: async () => {
    return (await api.get<UserRecentActivity[]>("/user/repayments/overview"))
      .data;
  },
  staleTime: 20 * 60 * 1000,
});
