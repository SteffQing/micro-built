"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverTrigger,
	PopoverContent,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { userNotifications } from "@/lib/queries/user/notifications";
import {
	markAllNotificationsRead,
	markNotificationRead,
} from "@/lib/mutations/user/notifications";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const groupByDate = (notifications: UserNotificationDto[]) => {
	return notifications.reduce((acc, notification) => {
		const date = new Date(notification.createdAt)
			.toLocaleDateString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
			})
			.toLocaleUpperCase();
		if (!acc[date]) acc[date] = [];
		acc[date].push(notification);
		return acc;
	}, {} as Record<string, UserNotificationDto[]>);
};

const formatTime = (iso: string) =>
	new Date(iso).toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
	});

export default function Notifications() {
	const [isOpen, setIsOpen] = useState(false);
	const [activeTab, setActiveTab] = useState("all");

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
	const readCount = notifications.filter((n) => n.isRead).length;

	const filtered =
		activeTab === "unread"
			? notifications.filter((n) => !n.isRead)
			: activeTab === "read"
			? notifications.filter((n) => n.isRead)
			: notifications;

	const grouped = groupByDate(filtered);

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button variant="secondary" className="rounded-full relative h-8 w-8">
					<Bell className="w-3 h-3" />
					{unreadCount > 0 && (
						<Badge className="absolute bg-[#8A0806] rounded-full -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
							{unreadCount > 99 ? "99+" : unreadCount}
						</Badge>
					)}
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-96 p-0" align="end">
				<div className="flex items-center gap-2 p-4 border-b">
					<Bell className="w-5 h-5" />
					<h3 className="font-semibold text-lg">Notifications</h3>
				</div>

				<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
					<div className="px-4 pt-2">
						<TabsList className="grid w-full grid-cols-3 h-auto p-0 bg-transparent">
							<TabsTrigger
								value="all"
								className="flex flex-col gap-1 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none pb-2">
								<span className="text-sm">All</span>
								<Badge
									variant="secondary"
									className="bg-red-600 text-white text-xs">
									{notifications.length}
								</Badge>
							</TabsTrigger>
							<TabsTrigger
								value="unread"
								className="flex flex-col gap-1 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none pb-2">
								<span className="text-sm">Unread</span>
								<Badge
									variant="secondary"
									className="bg-gray-500 text-white text-xs">
									{unreadCount}
								</Badge>
							</TabsTrigger>
							<TabsTrigger
								value="read"
								className="flex flex-col gap-1 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none pb-2">
								<span className="text-sm">Read</span>
								<Badge
									variant="secondary"
									className="bg-gray-500 text-white text-xs">
									{readCount}
								</Badge>
							</TabsTrigger>
						</TabsList>
					</div>

					<div className="px-4 py-2 flex items-center justify-end text-sm border-b">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => markAll.mutate()}
							disabled={markAll.isPending || unreadCount === 0}
							className="text-muted-foreground hover:text-foreground">
							<Check className="w-4 h-4 mr-1" />
							Mark all as read
						</Button>
					</div>

					<TabsContent value={activeTab} className="mt-0">
						<div className="max-h-96 overflow-y-auto">
							{isLoading ? (
								<div className="flex items-center justify-center p-8">
									<Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
								</div>
							) : filtered.length === 0 ? (
								<div className="p-8 text-center text-sm text-muted-foreground">
									No notifications yet. Updates on your loans, repayments and
									liquidations will appear here.
								</div>
							) : (
								Object.entries(grouped).map(([date, dateNotifications]) => (
									<div key={date}>
										<div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-gray-50">
											{date}
										</div>
										{dateNotifications.map((notification) => (
											<div
												key={notification.id}
												onClick={() =>
													!notification.isRead &&
													markOne.mutate(notification.id)
												}
												className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${
													!notification.isRead ? "bg-blue-50/30" : ""
												}`}>
												<div className="flex gap-3">
													<div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-blue-100">
														<Bell className="w-5 h-5 text-blue-600" />
													</div>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium text-gray-900 mb-1">
															{notification.title}
														</p>
														<p className="text-sm text-muted-foreground mb-1">
															{notification.description}
														</p>
														<div className="flex items-center justify-between">
															<span className="text-xs text-muted-foreground">
																{formatTime(notification.createdAt)}
															</span>
															{notification.callToActionUrl && (
																<Button
																	asChild
																	variant="ghost"
																	size="sm"
																	className="text-xs text-muted-foreground hover:text-foreground">
																	<Link href={notification.callToActionUrl}>
																		View
																	</Link>
																</Button>
															)}
														</div>
													</div>
													{!notification.isRead && (
														<div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
													)}
												</div>
											</div>
										))}
									</div>
								))
							)}
						</div>
					</TabsContent>
				</Tabs>
			</PopoverContent>
		</Popover>
	);
}
