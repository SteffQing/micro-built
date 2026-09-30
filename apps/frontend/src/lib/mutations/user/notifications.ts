import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";

const base = "/user/notifications";

export const markAllNotificationsRead = mutationOptions({
	mutationKey: [base, "mark-read"],
	mutationFn: async () => {
		const res = await api.patch<ApiRes<null>>(`${base}/mark-read`);
		return res.data;
	},
	onSuccess: () => queryClient.invalidateQueries({ queryKey: [base] }),
});

export const markNotificationRead = mutationOptions({
	mutationKey: [base, "read"],
	mutationFn: async (id: string) => {
		const res = await api.patch<ApiRes<null>>(`${base}/${id}/read`);
		return res.data;
	},
	onSuccess: () => queryClient.invalidateQueries({ queryKey: [base] }),
});
