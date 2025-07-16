import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
export interface UserRecentActivity {
  data: { title: string; description: string; date: string; source: string }[];
  message: string;
}

export const userRecentActivitiesQuery = queryOptions({
  queryKey: ["user-recent-activities"],
  queryFn: async () => {
    return (await api.get<UserRecentActivity>("/user/recent-activity")).data;
  },
  staleTime: 20 * 60 * 1000,
});
