import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions, type InfiniteData } from "@tanstack/react-query";

const base = "/user/notifications";

type Page = ApiRes<UserNotificationsDto>;
type Cached = Page | InfiniteData<Page> | undefined;

/**
 * Marks notifications read in every cached list (badge, popover, page, infinite list) right away, so the count and
 * the dots change on click instead of on the next refetch. `ids` undefined means all of them.
 */
function markCachedRead(ids?: string[]) {
	const readAt = new Date().toISOString();
	const page = (res: Page): Page => {
		if (!res.data) return res;
		let newlyRead = 0;
		const notifications = res.data.notifications.map((n) => {
			if (n.isRead || (ids && !ids.includes(n.id))) return n;
			newlyRead++;
			return { ...n, isRead: true, readAt };
		});
		// A page holds only some of the notifications, so the count is adjusted by what's known, not recounted.
		const unreadCount = ids ? Math.max(0, res.data.unreadCount - (newlyRead || ids.length)) : 0;
		return { ...res, data: { ...res.data, notifications, unreadCount } };
	};

	queryClient.setQueriesData<Cached>({ queryKey: [base] }, (old) => {
		if (!old) return old;
		if ("pages" in old) return { ...old, pages: old.pages.map(page) };
		return page(old);
	});
}

async function optimistic(ids?: string[]) {
	await queryClient.cancelQueries({ queryKey: [base] });
	const previous = queryClient.getQueriesData<Cached>({ queryKey: [base] });
	markCachedRead(ids);
	return { previous };
}

function rollback(context?: { previous: [readonly unknown[], Cached][] }) {
	for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
}

export const markAllNotificationsRead = mutationOptions({
	mutationKey: [base, "mark-read"],
	mutationFn: async () => {
		const res = await api.patch<ApiRes<null>>(`${base}/mark-read`);
		return res.data;
	},
	onMutate: () => optimistic(),
	onError: (_error, _vars, context) => rollback(context),
	onSettled: () => queryClient.invalidateQueries({ queryKey: [base] }),
});

export const markNotificationRead = mutationOptions({
	mutationKey: [base, "read"],
	mutationFn: async (id: string) => {
		const res = await api.patch<ApiRes<null>>(`${base}/${id}/read`);
		return res.data;
	},
	onMutate: (id) => optimistic([id]),
	onError: (_error, _id, context) => rollback(context),
	onSettled: () => queryClient.invalidateQueries({ queryKey: [base] }),
});
