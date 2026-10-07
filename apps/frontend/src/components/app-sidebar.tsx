"use client";

import * as React from "react";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { useQuery } from "@tanstack/react-query";
import { userNotifications } from "@/lib/queries/user/notifications";
import { SUPPORT_HREF } from "@/lib/support";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { NavMain } from "./nav-main";
import Link from "next/link";
import { useUserProvider } from "@/store/auth";
import { Logo } from "./logo";

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
    title: "Organizations",
    url: "/organizations",
    icon: icons.building,
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
        title: "Top-ups",
        url: "/loans/topups",
      },
      {
        title: "Tenure Changes",
        url: "/loans/tenure-changes",
      },
    ],
  },
  {
    title: "Commodities",
    url: "/commodities",
    icon: icons.creditCard,
  },
  {
    title: "Variations",
    url: "/variations",
    icon: icons.fileSpreadsheet,
  },
  {
    title: "Repayments",
    url: "/repayments",
    icon: icons.repayments,
  },
  {
    title: "Approvals",
    url: "/approvals",
    icon: icons.badgeCheck,
  },
];
// Super admins also read the audit log.
const navSuperAdmin = [
  ...navAdmin,
  {
    title: "Audit Log",
    url: "/audit",
    icon: icons.shield,
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
    title: "Loans",
    url: "/loans",
    icon: icons.loans,
  },
  {
    title: "Repayments",
    url: "/repayments",
    icon: icons.repayments,
  },
];

// Pinned to the bottom for every role; signing out is in the avatar's menu.
const navFooter = [
  {
    title: "Notifications",
    url: "/notifications",
    icon: icons.notifications,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: icons.settings,
  },
  {
    title: "Help & support",
    url: SUPPORT_HREF,
    icon: icons.support,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { userRole, isUserLoading } = useUserProvider();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  // Same query as the header bell's badge, so it shares the cache and the live stream's refetches.
  const { data: notifications } = useQuery({ ...userNotifications(1, 1), enabled: !isUserLoading });
  const unread = notifications?.data?.unreadCount ?? 0;

  // The mobile sidebar is a sheet over the page: close it once any link has taken the user somewhere.
  React.useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center justify-between w-full">
            <Link href="/dashboard" className="rounded-md p-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <Logo className="h-9 w-auto text-brand" />
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
                : userRole === "SUPER_ADMIN"
                ? navSuperAdmin
                : navAdmin
            }
          />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavMain items={navFooter.map((item) => (item.url === "/notifications" ? { ...item, badge: unread } : item))} />
      </SidebarFooter>
    </Sidebar>
  );
}
