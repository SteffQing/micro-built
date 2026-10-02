"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	markAllNotificationsRead,
	markNotificationRead,
} from "@/lib/mutations/user/notifications";
import { userNotifications } from "@/lib/queries/user/notifications";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import Link from "next/link";
import { useState } from "react";

const LIMIT = 20;

export default function NotificationsPage() {
	const [page, setPage] = useState(1);
	const { data, isLoading } = useQuery(userNotifications(page, LIMIT));
	const markAll = useMutation(markAllNotificationsRead);
	const markOne = useMutation(markNotificationRead);

	const notifications = data?.data?.notifications ?? [];
	const unreadCount = data?.data?.unreadCount ?? 0;
	const total = data?.meta?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / LIMIT));

	return (
		<div className="flex flex-col gap-4 p-4 lg:p-6 max-w-3xl">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<h1 className="text-xl font-semibold">Notifications</h1>
					{unreadCount > 0 && (
						<Badge className="bg-destructive text-destructive-foreground">{unreadCount} unread</Badge>
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
					<Icon icon={icons.loaderCircle} size={24} className="animate-spin text-muted-foreground" />
				</div>
			) : notifications.length === 0 ? (
				<div className="flex flex-col items-center gap-2 p-16 text-center text-muted-foreground border rounded-lg">
					<Icon icon={icons.notifications} size={32} />
					<p className="text-sm">
						No notifications yet. Updates on your loans, repayments and
						liquidations will appear here.
					</p>
				</div>
			) : (
				<div className="border rounded-lg divide-y">
					{notifications.map((notification) => (
						<div
							key={notification.id}
							onClick={() =>
								!notification.isRead && markOne.mutate(notification.id)
							}
							className={`p-4 flex gap-3 hover:bg-muted cursor-pointer ${
								!notification.isRead ? "bg-primary/5" : ""
							}`}>
							<div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-primary/10">
								<Icon icon={icons.notifications} size={20} className="text-primary" />
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium mb-1">{notification.title}</p>
								<p className="text-sm text-muted-foreground mb-1">
									{notification.description}
								</p>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<span className="text-xs text-muted-foreground">
										{new Date(notification.createdAt).toLocaleString("en-US", {
											month: "long",
											day: "numeric",
											year: "numeric",
											hour: "numeric",
											minute: "2-digit",
										})}
									</span>
									{notification.callToActionUrl && (
										<Button
											asChild
											variant="ghost"
											size="sm"
											className="text-xs">
											<Link href={notification.callToActionUrl}>View</Link>
										</Button>
									)}
								</div>
							</div>
							{!notification.isRead && (
								<div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
							)}
						</div>
					))}
				</div>
			)}

			{totalPages > 1 && (
				<div className="flex flex-wrap items-center justify-between gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page <= 1}>
						Previous
					</Button>
					<span className="text-sm text-muted-foreground">
						Page {page} of {totalPages}
					</span>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={page >= totalPages}>
						Next
					</Button>
				</div>
			)}
		</div>
	);
}
