import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
export interface UserRecentActivity {
  title: string;
  description: string;
  date: string;
  source: string;
}

export const userRecentActivitiesQuery = queryOptions({
  queryKey: ["user-recent-activities"],
  queryFn: async () => {
    return (await api.get<UserRecentActivity[]>("/user/recent-activity")).data;
  },
  staleTime: 20 * 60 * 1000,
});
