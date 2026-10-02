"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	markAllNotificationsRead,
	markNotificationRead,
} from "@/lib/mutations/user/notifications";
import { api } from "@/lib/axios";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useRef } from "react";

const LIMIT = 20;
const base = "/user/notifications";

const getDateGroup = (iso: string): string => {
	const date = new Date(iso);
	const now = new Date();

	const isToday =
		date.getDate() === now.getDate() &&
		date.getMonth() === now.getMonth() &&
		date.getFullYear() === now.getFullYear();

	if (isToday) return "Today";

	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	const isYesterday =
		date.getDate() === yesterday.getDate() &&
		date.getMonth() === yesterday.getMonth() &&
		date.getFullYear() === yesterday.getFullYear();

	if (isYesterday) return "Yesterday";

	return "Earlier";
};

const groupByDate = (notifications: UserNotificationDto[]) => {
	const order: Record<string, number> = { Today: 0, Yesterday: 1, Earlier: 2 };
	const grouped: Record<string, UserNotificationDto[]> = {};

	for (const n of notifications) {
		const group = getDateGroup(n.createdAt);
		if (!grouped[group]) grouped[group] = [];
		grouped[group].push(n);
	}

	return Object.entries(grouped).sort(
		([a], [b]) => (order[a] ?? 3) - (order[b] ?? 3),
	);
};

export default function NotificationsPage() {
	const router = useRouter();
	const loadMoreRef = useRef<HTMLDivElement>(null);

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		useInfiniteQuery({
			queryKey: [base, "infinite", LIMIT],
			queryFn: async ({ pageParam }) => {
				const res = await api.get<ApiRes<UserNotificationsDto>>(base, {
					params: { page: pageParam, limit: LIMIT },
				});
				return res.data;
			},
			getNextPageParam: (lastPage, allPages) => {
				const total = lastPage?.meta?.total ?? 0;
				const loaded = allPages.length * LIMIT;
				return loaded < total ? allPages.length + 1 : undefined;
			},
			initialPageParam: 1,
			staleTime: 60 * 1000,
		});

	const markAll = useMutation(markAllNotificationsRead);
	const markOne = useMutation(markNotificationRead);

	const allNotifications =
		data?.pages.flatMap((p) => p?.data?.notifications ?? []) ?? [];
	const firstPage = data?.pages[0];
	const unreadCount = firstPage?.data?.unreadCount ?? 0;

	const grouped = groupByDate(allNotifications);

	const handleClick = (notification: UserNotificationDto) => {
		if (!notification.isRead) {
			markOne.mutate(notification.id);
		}
		if (notification.callToActionUrl) {
			router.push(notification.callToActionUrl);
		}
	};

	const observerCallback = useCallback(
		(entries: IntersectionObserverEntry[]) => {
			if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
				fetchNextPage();
			}
		},
		[hasNextPage, isFetchingNextPage, fetchNextPage],
	);

	useEffect(() => {
		const el = loadMoreRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(observerCallback, {
			threshold: 0.1,
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [observerCallback]);

	return (
		<div className="flex flex-col gap-4 p-4 lg:p-6 max-w-3xl">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<h1 className="text-xl font-semibold">Notifications</h1>
					{unreadCount > 0 && (
						<Badge className="bg-brand text-brand-foreground">
							{unreadCount} unread
						</Badge>
					)}
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => markAll.mutate()}
					disabled={markAll.isPending || unreadCount === 0}>
					<Icon icon={icons.check} size={16} className="mr-1" />
					Mark all as read
				</Button>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center p-16">
					<Icon
						icon={icons.loaderCircle}
						size={24}
						className="animate-spin text-muted-foreground"
					/>
				</div>
			) : allNotifications.length === 0 ? (
				<div className="flex flex-col items-center gap-2 p-16 text-center text-muted-foreground border rounded-lg">
					<Icon icon={icons.notifications} size={32} />
					<p className="text-sm">
						No notifications yet. Updates on your loans, repayments and
						liquidations will appear here.
					</p>
				</div>
			) : (
				<div className="border rounded-lg divide-y">
					{grouped.map(([date, dateNotifications]) => (
						<div key={date}>
							<div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted">
								{date}
							</div>
							{dateNotifications.map((notification) => (
								<div
									key={notification.id}
									onClick={() => handleClick(notification)}
									className={`p-4 flex gap-3 hover:bg-muted cursor-pointer ${
										!notification.isRead ? "bg-brand/5" : ""
									}`}>
									<div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-brand/10">
										<Icon
											icon={icons.notifications}
											size={20}
											className="text-brand"
										/>
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium mb-1">
											{notification.title}
										</p>
										<p className="text-sm text-muted-foreground mb-1">
											{notification.description}
										</p>
										<span className="text-xs text-muted-foreground">
											{formatDistanceToNow(new Date(notification.createdAt), {
												addSuffix: true,
											})}
										</span>
									</div>
									{!notification.isRead && (
										<div className="w-2 h-2 bg-brand rounded-full mt-2 shrink-0" />
									)}
								</div>
							))}
						</div>
					))}

					{/* Intersection observer sentinel */}
					{hasNextPage && (
						<div ref={loadMoreRef} className="p-4 text-center">
							{isFetchingNextPage ? (
								<Icon
									icon={icons.loaderCircle}
									size={20}
									className="animate-spin text-muted-foreground mx-auto"
								/>
							) : (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => fetchNextPage()}
									className="text-muted-foreground">
									Load more
								</Button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
