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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NavMain } from "./nav-main";
import { Logo } from "./logo";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";

const data = {
  user: {
    name: "Hiniola",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/admin",
      icon: Icons.menu,
    },
    {
      title: "Customers",
      url: "/admin/customers",
      icon: Icons.document1,
    },
    {
      title: "Loan Management",
      url: "/admin/loan-management",
      icon: Icons.document2,
      items: [
        {
          title: "Loan Application",
          url: "/admin/loan-management/loan-application",
        },
        {
          title: "Profile Management",
          url: "/admin/loan-management/profile-management",
        },
      ],
    },
    {
      title: "Repayments",
      url: "/admin/repayments",
      icon: Icons.tools,
    },
    {
      title: "Vendor/Inventory",
      url: "/admin/vendor-inventory",
      icon: Icons.view,
    },
    {
      title: "Reconcilation Tool",
      url: "/admin/reconciliation-tool",
      icon: Icons.tools,
    },
    {
      title: "Loan Reports",
      url: "/admin/loan-reports",
      icon: Icons.document1,
    },
    {
      title: "Settings",
      url: "/admin/settings",
      icon: Icons.settings,
    },
  ],
  navUser: [
    {
      title: "Dashboard",
      url: "/user",
      icon: Icons.menu,
    },
    {
      title: "My Loans",
      url: "/user/loans",
      icon: Icons.document2,
    },
    {
      title: "Loan Application",
      url: "/user/apply",
      icon: Icons.document1,
    },
    {
      title: "Repayments History",
      url: "/user/repayments",
      icon: Icons.tools,
    },
    {
      title: "My Profile",
      url: "/user/profile",
      icon: Icons.settings,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, isAdmin } = useAuthStore();
  console.log({ userRole: user?.role });
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center justify-between w-full">
            <Link href="/admin" className="p-2">
              <Logo className="h-4 w-auto" />
            </Link>
            <SidebarTrigger className="-ml-1" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={user?.role === "ADMIN" ? data.navMain : data.navUser} />
      </SidebarContent>
      <SidebarFooter>
        <NavUserLogout />
      </SidebarFooter>
    </Sidebar>
  );
}
