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
  queryFn: async (): Promise<UserRecentActivity[]> => {
    const response = await api.get<{ data: UserRecentActivity[] }>(
      "/user/recent-activity"
    );
    return response.data.data;
  },
  staleTime: 20 * 60 * 1000,
});
