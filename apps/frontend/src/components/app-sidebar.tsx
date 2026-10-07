"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { SUPPORT_HREF } from "@/lib/support";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { SidebarCallouts } from "./callouts/sidebar-callouts";
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
    icon: icons.accountOfficers,
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
// Super admins also read the audit log and manage the sidebar's callouts.
const navSuperAdmin = [
  ...navAdmin,
  {
    title: "Audit Log",
    url: "/audit",
    icon: icons.shield,
  },
  {
    title: "Callouts",
    url: "/callouts",
    icon: icons.callouts,
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

// Pinned to the bottom for every role, as a row of icons; signing out is in the avatar's menu.
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

// Where the menu will be, while the account (and so which menu) loads: rows shaped like its links.
const NAV_SKELETON_WIDTHS = ["w-24", "w-28", "w-20", "w-32", "w-24", "w-16", "w-28"];

function NavSkeleton() {
  return (
    <div role="status" aria-busy="true" className="skeleton-reveal grid gap-1 p-2">
      <span className="sr-only">Loading menu…</span>
      {NAV_SKELETON_WIDTHS.map((width, i) => (
        <div key={i} className="flex h-12 items-center gap-3 rounded-md px-4">
          <Skeleton className="size-6 shrink-0 rounded-md" />
          <Skeleton className={cn("h-3.5", width)} />
        </div>
      ))}
    </div>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { userRole, isUserLoading } = useUserProvider();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();

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
          <NavSkeleton />
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
        {/*
          The callout stays in view at the foot of the sidebar while a long menu scrolls behind it (a fade shows there's
          more); scrolled to the end, every link sits above it. On a short screen it scrolls with the menu instead, so
          it never crowds the links out.
        */}
        <div className="relative mt-auto bg-sidebar px-2 pt-2 pb-2 before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-sidebar before:to-transparent [@media(min-height:640px)]:sticky [@media(min-height:640px)]:bottom-0 [&:not(:has(section))]:hidden">
          <SidebarCallouts enabled={!isUserLoading && Boolean(userRole)} />
        </div>
      </SidebarContent>
      <SidebarFooter>
        <nav aria-label="More" className="flex items-center justify-around gap-1 border-t pt-2">
          {navFooter.map(({ title, url, icon }) => {
            const active = pathname.startsWith(url);
            return (
              <Tooltip key={title}>
                <TooltipTrigger asChild>
                  <Link
                    href={url}
                    aria-label={title}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "grid size-10 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    )}
                  >
                    <Icon icon={icon} size={20} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top">{title}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </SidebarFooter>
    </Sidebar>
  );
}
