"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	markAllNotificationsRead,
	markNotificationRead,
} from "@/lib/mutations/user/notifications";
import { userNotifications } from "@/lib/queries/user/notifications";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Check, Loader2 } from "lucide-react";
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
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h1 className="text-xl font-semibold">Notifications</h1>
					{unreadCount > 0 && (
						<Badge className="bg-red-600 text-white">{unreadCount} unread</Badge>
					)}
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => markAll.mutate()}
					disabled={markAll.isPending || unreadCount === 0}>
					<Check className="w-4 h-4 mr-1" />
					Mark all as read
				</Button>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center p-16">
					<Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
				</div>
			) : notifications.length === 0 ? (
				<div className="flex flex-col items-center gap-2 p-16 text-center text-muted-foreground border rounded-lg">
					<Bell className="w-8 h-8" />
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
							className={`p-4 flex gap-3 hover:bg-gray-50 cursor-pointer ${
								!notification.isRead ? "bg-blue-50/30" : ""
							}`}>
							<div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-blue-100">
								<Bell className="w-5 h-5 text-blue-600" />
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium mb-1">{notification.title}</p>
								<p className="text-sm text-muted-foreground mb-1">
									{notification.description}
								</p>
								<div className="flex items-center justify-between">
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
								<div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
							)}
						</div>
					))}
				</div>
			)}

			{totalPages > 1 && (
				<div className="flex items-center justify-between">
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
