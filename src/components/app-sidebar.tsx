"use client";

import * as React from "react";
import { Icons } from "@/components/icons";
import { NavUserLogout } from "@/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavMain } from "./nav-main";
import Link from "next/link";
import { useUserProvider } from "@/store/auth";
import { Loader2 } from "lucide-react";
import Image from "next/image";

const navAdmin = [
	{
		title: "Dashboard",
		url: "/dashboard",
		icon: Icons.menu,
	},
	{
		title: "Customers",
		url: "/customers",
		icon: Icons.document1,
	},
	{
		title: "Loan Management",
		url: "/loans",
		icon: Icons.document2,
		items: [
			{
				title: "Loan Report",
				url: "/loans/report",
			},
			{
				title: "Cash Loans",
				url: "/loans/cash",
			},
			{
				title: "Commodity Loans",
				url: "/loans/commodity",
			},
		],
	},
	{
		title: "Repayments",
		url: "/repayments",
		icon: Icons.tools,
	},
	{
		title: "Settings",
		url: "/settings",
		icon: Icons.settings,
	},
];
const navUser = [
	{
		title: "Dashboard",
		url: "/dashboard",
		icon: Icons.menu,
	},
	{
		title: "Loans/Asset Request",
		url: "/loan-request",
		icon: Icons.document2,
	},
	{
		title: "My Repayments",
		url: "/repayments",
		icon: Icons.document1,
	},
	{
		title: "Settings",
		url: "/settings",
		icon: Icons.settings,
	},
];

const navMarketer = [
	{
		title: "Dashboard",
		url: "/dashboard",
		icon: Icons.menu,
	},
	{
		title: "Customers",
		url: "/customers",
		icon: Icons.document1,
	},
	{
		title: "My Repayments",
		url: "/repayments",
		icon: Icons.document1,
	},
	{
		title: "Settings",
		url: "/settings",
		icon: Icons.settings,
	},
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { userRole, isUserLoading } = useUserProvider();
	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem className="flex items-center justify-between w-full">
						<Link href="/dashboard" className="p-2 relative w-[215px] h-[63px]">
							<Image
								src="/logo.png"
								alt="MicroBuilt Logo"
								fill
								className="object-contain"
							/>
						</Link>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				{isUserLoading ? (
					<div className="w-full h-full flex items-center justify-center">
						<Loader2 className="w-6 h-6 text-primary font-bold animate-spin" />
					</div>
				) : (
					<NavMain
						items={
							userRole === "CUSTOMER"
								? navUser
								: userRole === "MARKETER"
								? navMarketer
								: navAdmin
						}
					/>
				)}
			</SidebarContent>
			<SidebarFooter>
				<NavUserLogout />
			</SidebarFooter>
		</Sidebar>
	);
}
