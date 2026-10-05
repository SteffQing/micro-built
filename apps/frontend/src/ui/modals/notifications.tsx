"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Popover,
	PopoverTrigger,
	PopoverContent,
} from "@/components/ui/popover";
import { userNotifications } from "@/lib/queries/user/notifications";
import {
	markAllNotificationsRead,
	markNotificationRead,
} from "@/lib/mutations/user/notifications";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

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

export default function Notifications() {
	const [isOpen, setIsOpen] = useState(false);
	const [filter, setFilter] = useState<"all" | "unread">("all");
	const router = useRouter();

	const { data, isLoading } = useQuery({
		...userNotifications(1, 50),
		enabled: isOpen,
		refetchInterval: isOpen ? 60 * 1000 : false,
	});
	const { data: badgeData } = useQuery(userNotifications(1, 1));

	const markAll = useMutation(markAllNotificationsRead);
	const markOne = useMutation(markNotificationRead);

	const notifications = data?.data?.notifications ?? [];
	const unreadCount =
		data?.data?.unreadCount ?? badgeData?.data?.unreadCount ?? 0;

	const filtered =
		filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

	const grouped = groupByDate(filtered);

	const handleClick = (notification: UserNotificationDto) => {
		if (!notification.isRead) {
			markOne.mutate(notification.id);
		}
		if (notification.callToActionUrl) {
			setIsOpen(false);
			router.push(notification.callToActionUrl);
		}
	};

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative size-9 rounded-full"
					aria-label={
						unreadCount > 0
							? `Notifications, ${unreadCount} unread`
							: "Notifications"
					}>
					<Icon icon={icons.notifications} size={18} />
					{unreadCount > 0 && (
						<span
							aria-hidden
							className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-brand-foreground tabular-nums ring-2 ring-background">
							{unreadCount > 99 ? "99+" : unreadCount}
						</span>
					)}
				</Button>
			</PopoverTrigger>

			<PopoverContent
				align="end"
				sideOffset={8}
				collisionPadding={12}
				className="flex max-h-[min(36rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden p-0">
				<div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
					<div className="flex items-baseline gap-2">
						<h3 className="text-sm font-semibold">Notifications</h3>
						{unreadCount > 0 && (
							<span className="text-xs text-muted-foreground tabular-nums">
								{unreadCount} unread
							</span>
						)}
					</div>
					<button
						type="button"
						onClick={() => markAll.mutate()}
						disabled={markAll.isPending || unreadCount === 0}
						className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
						<Icon icon={icons.checkCheck} size={14} />
						Mark all read
					</button>
				</div>

				<div
					role="group"
					aria-label="Filter notifications"
					className="mx-4 mb-2 grid grid-cols-2 rounded-lg bg-muted p-0.5 text-xs font-medium">
					{(["all", "unread"] as const).map((value) => (
						<button
							key={value}
							type="button"
							aria-pressed={filter === value}
							onClick={() => setFilter(value)}
							className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-popover aria-pressed:text-foreground aria-pressed:shadow-sm">
							{value === "all" ? "All" : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
						</button>
					))}
				</div>

				<div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
					{isLoading ? (
						<ul aria-label="Loading notifications" className="space-y-1 p-2">
							{Array.from({ length: 4 }).map((_, i) => (
								<li key={i} className="space-y-2 rounded-lg px-3 py-3">
									<Skeleton className="h-3.5 w-2/3" />
									<Skeleton className="h-3 w-full" />
									<Skeleton className="h-3 w-1/4" />
								</li>
							))}
						</ul>
					) : filtered.length === 0 ? (
						<div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
							<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
								<Icon
									icon={filter === "unread" ? icons.checkCheck : icons.notifications}
									size={18}
								/>
							</div>
							<p className="text-sm font-medium">
								{filter === "unread" ? "You're all caught up" : "No notifications yet"}
							</p>
							<p className="max-w-60 text-xs text-muted-foreground">
								Updates on your loans, repayments and liquidations will appear here.
							</p>
						</div>
					) : (
						grouped.map(([date, dateNotifications]) => (
							<section key={date} aria-label={date}>
								<h4 className="sticky top-0 z-10 bg-popover/95 px-4 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase backdrop-blur">
									{date}
								</h4>
								<ul className="px-2 pb-1">
									{dateNotifications.map((notification) => (
										<li key={notification.id}>
											<button
												type="button"
												onClick={() => handleClick(notification)}
												className="group relative flex w-full gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
												<span
													aria-hidden
													className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.isRead ? "bg-transparent" : "bg-brand"}`}
												/>
												<span className="min-w-0 flex-1">
													<span
														className={`block text-sm leading-snug break-words ${notification.isRead ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
														{notification.title}
														{!notification.isRead && <span className="sr-only"> (unread)</span>}
													</span>
													<span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed break-words text-muted-foreground">
														{notification.description}
													</span>
													<time
														dateTime={notification.createdAt}
														className="mt-1 block text-[11px] text-muted-foreground tabular-nums">
														{formatDistanceToNow(new Date(notification.createdAt), {
															addSuffix: true,
														})}
													</time>
												</span>
											</button>
										</li>
									))}
								</ul>
							</section>
						))
					)}
				</div>

				<div className="border-t p-2">
					<button
						type="button"
						className="w-full rounded-md py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						onClick={() => {
							setIsOpen(false);
							router.push("/notifications");
						}}>
						View all notifications
					</button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
