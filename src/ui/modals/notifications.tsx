import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverTrigger,
	PopoverContent,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { useQuery } from "@tanstack/react-query";
import {
	Bell,
	X,
	Check,
	CreditCard,
	CheckCircle,
	XCircle,
	HandCoins,
} from "lucide-react";
import { useState } from "react";

type NotificationType = 
	| "loan_request"
	| "loan_approval"
	| "loan_rejection"
	| "loan_disbursement"
	| "repayment"
	| "overdue_repayment"
	| "loan_tenure";

interface Notification {
	id: string;
	type: NotificationType;
	title: string;
	message: string;
	timestamp: string;
	date: Date;
	status: "read" | "unread";
	amount?: string;
	loanId?: string;
	actionText?: string;
	actionUrl?: string;
	user?: {
		name: string;
		avatar?: string;
	};
}

interface NotificationCounts {
	all: number;
	loanRequests: number;
	repayments: number;
	unread: number;
	read: number;
}

const getNotificationIcon = (type: NotificationType) => {
	switch (type) {
		case "loan_request":
			return <CreditCard className="w-5 h-5 text-blue-600" />;
		case "repayment":
		case "overdue_repayment":
			return <HandCoins className="w-5 h-5 text-blue-600" />;
		case "loan_approval":
			return <CheckCircle className="w-5 h-5 text-green-600" />;
		case "loan_rejection":
			return <XCircle className="w-5 h-5 text-red-600" />;
		case "loan_disbursement":
			return <HandCoins className="w-5 h-5 text-green-600" />;
		case "loan_tenure":
			return <CreditCard className="w-5 h-5 text-orange-600" />;
		// case "inventory_alert":
		//   return <AlertCircle className="w-5 h-5 text-red-600" />;
		default:
			return <Bell className="w-5 h-5 text-gray-600" />;
	}
};

const getIconBackground = (type: NotificationType) => {
	switch (type) {
		case "loan_approval":
		case "loan_disbursement":
			return "bg-green-100";
		case "loan_rejection":
		case "overdue_repayment":
			return "bg-red-100";
		case "loan_tenure":
			return "bg-orange-100";
		default:
			return "bg-blue-100";
	}
};

// const mockNotifications: Notification[] = [
//   {
//     id: "notif-1",
//     type: "loan_request",
//     title: "Loan Request Submitted",
//     message: "You have successfully submitted a loan request of ₦200,000.",
//     timestamp: "2025-07-24T08:30:00Z",
//     date: "2025-07-24",
//     status: "unread",
//     amount: "200000",
//     loanId: "LN-00123",
//     actionText: "View Request",
//     actionUrl: "/loans/LN-00123",
//   },
//   {
//     id: "notif-2",
//     type: "loan_approval",
//     title: "Loan Approved",
//     message: "Congratulations! Your loan request of ₦200,000 has been approved.",
//     timestamp: "2025-07-23T14:45:00Z",
//     date: "2025-07-23",
//     status: "read",
//     amount: "200000",
//     loanId: "LN-00123",
//     actionText: "View Details",
//     actionUrl: "/loans/LN-00123",
//   },
//   {
//     id: "notif-3",
//     type: "loan_rejection",
//     title: "Loan Rejected",
//     message: "Unfortunately, your loan request has been rejected.",
//     timestamp: "2025-07-22T10:00:00Z",
//     date: "2025-07-22",
//     status: "read",
//     loanId: "LN-00124",
//     actionText: "Try Again",
//     actionUrl: "/loans/request",
//   },
//   {
//     id: "notif-4",
//     type: "loan_disbursement",
//     title: "Loan Disbursed",
//     message: "₦200,000 has been disbursed to your account.",
//     timestamp: "2025-07-22T12:15:00Z",
//     date: "2025-07-22",
//     status: "unread",
//     amount: "200000",
//     loanId: "LN-00123",
//     actionText: "View Receipt",
//     actionUrl: "/loans/LN-00123",
//   },
//   {
//     id: "notif-5",
//     type: "repayment",
//     title: "Repayment Received",
//     message: "You have made a repayment of ₦50,000.",
//     timestamp: "2025-07-20T09:00:00Z",
//     date: "2025-07-20",
//     status: "read",
//     amount: "50000",
//     loanId: "LN-00123",
//     actionText: "View History",
//     actionUrl: "/loans/LN-00123/repayments",
//   },
//   {
//     id: "notif-6",
//     type: "overdue_repayment",
//     title: "Overdue Repayment",
//     message: "You have an overdue repayment of ₦50,000. Please pay immediately to avoid penalties.",
//     timestamp: "2025-07-19T07:30:00Z",
//     date: "2025-07-19",
//     status: "unread",
//     amount: "50000",
//     loanId: "LN-00123",
//     actionText: "Repay Now",
//     actionUrl: "/loans/LN-00123/repayments",
//   },
//   {
//     id: "notif-7",
//     type: "loan_tenure",
//     title: "Loan Tenure Ending Soon",
//     message: "Your loan tenure ends in 3 days. Ensure all repayments are completed.",
//     timestamp: "2025-07-18T16:20:00Z",
//     date: "2025-07-18",
//     status: "unread",
//     loanId: "LN-00123",
//     actionText: "View Loan",
//     actionUrl: "/loans/LN-00123",
//   },
// ];

const mockCounts: NotificationCounts = {
	all: 12,
	loanRequests: 6,
	repayments: 4,
	unread: 4,
	read: 2,
};

export default function Notifications() {
	const [isOpen, setIsOpen] = useState(false);
	const [activeTab, setActiveTab] = useState("all");
	const [notifications, setNotifications] = useState<Notification[]>([]);

	const markAllAsRead = () => {
		setNotifications((prev) =>
			prev.map((notification) => ({
				...notification,
				status: "read" as const,
			})),
		);
	};

	const filterNotifications = (tab: string) => {
		switch (tab) {
			case "loan-requests":
				return notifications.filter((n) => n.type === "loan_request");
			case "repayments":
				return notifications.filter(
					(n) => n.type === "repayment" || n.type === "overdue_repayment",
				);
			//   case "inventory":
			//     return notifications.filter((n) => n.type === "inventory_alert");
			default:
				return notifications;
		}
	};

	const groupNotificationsByDate = (notifications: Notification[]) => {
		const grouped = notifications.reduce((acc, notification) => {
			const date = notification.date
				.toLocaleDateString("en-US", {
					year: "numeric",
					month: "long",
					day: "numeric",
				})
				.toLocaleUpperCase();
			if (!acc[date]) {
				acc[date] = [];
			}
			acc[date].push(notification);
			return acc;
		}, {} as Record<string, Notification[]>);

		return grouped;
	};

	const filteredNotifications = filterNotifications(activeTab);
	const groupedNotifications = groupNotificationsByDate(filteredNotifications);

	//   const { data, isLoading } = useQuery({});

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="secondary"
					className="rounded-full relative h-8 w-8"
					disabled>
					<Bell className="w-3 h-3" />
					{/* {notificationCount > 0 && (
            <Badge className="absolute bg-[#8A0806] rounded-full -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {notificationCount > 99 ? "99+" : notificationCount}
            </Badge>
          )} */}
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-96 p-0" align="end">
				<div className="flex items-center justify-between p-4 border-b">
					<div className="flex items-center gap-2">
						<Bell className="w-5 h-5" />
						<h3 className="font-semibold text-lg">Notifications</h3>
					</div>
					<Button variant="ghost" size="icon" className="h-6 w-6">
						<X className="w-4 h-4" />
					</Button>
				</div>

				<div className="p-4 text-sm text-muted-foreground border-b">
					All new notifications on loan requests, inventories and repayments
					will appear here.
				</div>

				<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
					<div className="px-4 pt-2">
						<TabsList className="grid w-full grid-cols-4 h-auto p-0 bg-transparent">
							<TabsTrigger
								value="all"
								className="flex flex-col gap-1 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none pb-2">
								<span className="text-sm">All</span>
								<Badge
									variant="secondary"
									className="bg-red-600 text-white text-xs">
									{mockCounts.all}
								</Badge>
							</TabsTrigger>
							<TabsTrigger
								value="loan-requests"
								className="flex flex-col gap-1 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none pb-2">
								<span className="text-sm">Loan Requests</span>
								<Badge
									variant="secondary"
									className="bg-red-600 text-white text-xs">
									{mockCounts.loanRequests}
								</Badge>
							</TabsTrigger>
							<TabsTrigger
								value="repayments"
								className="flex flex-col gap-1 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none pb-2">
								<span className="text-sm">Repayments</span>
								<Badge
									variant="secondary"
									className="bg-gray-500 text-white text-xs">
									{mockCounts.repayments}
								</Badge>
							</TabsTrigger>
						</TabsList>
					</div>

					<div className="px-4 py-2 flex items-center justify-between text-sm border-b">
						<div className="flex gap-4">
							<span className="text-muted-foreground">
								Unread <strong>{mockCounts.unread}</strong>
							</span>
							<span className="text-muted-foreground">
								Read <strong>{mockCounts.read}</strong>
							</span>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={markAllAsRead}
							className="text-muted-foreground hover:text-foreground">
							<Check className="w-4 h-4 mr-1" />
							Mark all as read
						</Button>
					</div>

					<TabsContent value={activeTab} className="mt-0">
						<div className="max-h-96 overflow-y-auto">
							{Object.entries(groupedNotifications).map(
								([date, dateNotifications]) => (
									<div key={date}>
										<div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-gray-50">
											{date}
										</div>
										{dateNotifications.map((notification) => (
											<div
												key={notification.id}
												className={`p-4 border-b hover:bg-gray-50 ${
													notification.status === "unread"
														? "bg-blue-50/30"
														: ""
												}`}>
												<div className="flex gap-3">
													<div
														className={`w-10 h-10 rounded-full flex items-center justify-center ${getIconBackground(
															notification.type,
														)}`}>
														{notification.user ? (
															<Avatar className="w-10 h-10">
																<AvatarImage
																	src={
																		notification.user.avatar ||
																		"/placeholder.svg"
																	}
																	alt={notification.user.name}
																/>
																<AvatarFallback>
																	{notification.user.name
																		.split(" ")
																		.map((n) => n[0])
																		.join("")}
																</AvatarFallback>
															</Avatar>
														) : (
															getNotificationIcon(notification.type)
														)}
													</div>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium text-gray-900 mb-1">
															{notification.message}
														</p>
														<div className="flex items-center justify-between">
															<span className="text-xs text-muted-foreground">
																{notification.timestamp}
															</span>
															{notification.actionText && (
																<Button
																	variant="ghost"
																	size="sm"
																	className="text-xs text-muted-foreground hover:text-foreground">
																	{notification.actionText}
																</Button>
															)}
														</div>
													</div>
													{notification.status === "unread" && (
														<div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
													)}
												</div>
											</div>
										))}
									</div>
								),
							)}
						</div>
					</TabsContent>
				</Tabs>
			</PopoverContent>
		</Popover>
	);
}
