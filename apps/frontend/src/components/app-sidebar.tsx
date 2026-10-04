"use client";

import * as React from "react";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
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
import Image from "next/image";

const navAdmin = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: icons.dashboard,
  },
  {
    title: "Customers",
    url: "/customers",
    icon: icons.customers,
  },
  {
    title: "Account Officers",
    url: "/account-officers",
    icon: icons.customers,
  },
  {
    title: "Loan Management",
    url: "/loans",
    icon: icons.loans,
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
      {
        title: "Tenure Changes",
        url: "/loans/tenure-changes",
      },
      {
        title: "Top-ups",
        url: "/loans/topups",
      },
    ],
  },
  {
    title: "Commodities",
    url: "/commodities",
    icon: icons.creditCard,
  },
  {
    title: "Repayments",
    url: "/repayments",
    icon: icons.repayments,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: icons.settings,
  },
];
const navUser = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: icons.dashboard,
  },
  {
    title: "Loans/Asset Request",
    url: "/loan-request",
    icon: icons.loans,
  },
  {
    title: "My Repayments",
    url: "/repayments",
    icon: icons.repayments,
  },
  {
    title: "Statement",
    url: "/statement",
    icon: icons.file,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: icons.settings,
  },
];

const navMarketer = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: icons.dashboard,
  },
  {
    title: "Customers",
    url: "/customers",
    icon: icons.customers,
  },
  {
    title: "My Repayments",
    url: "/repayments",
    icon: icons.repayments,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: icons.settings,
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
                sizes="215px"
                className="object-contain"
              />
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {isUserLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Icon icon={icons.loaderCircle} size={24} className="text-primary animate-spin" />
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
