import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

const base = "/user/notifications";

export const userNotifications = (page = 1, limit = 20) =>
	queryOptions({
		queryKey: [base, page, limit],
		queryFn: async () => {
			const res = await api.get<ApiRes<UserNotificationsDto>>(base, {
				params: { page, limit },
			});
			return res.data;
		},
		staleTime: 60 * 1000,
	});
