"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/icon";
import { icons, type IconData } from "@/components/icon";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { onSupportEvent } from "@/lib/support-events";
import { SUPPORT_MAILTO } from "@/lib/support";
import { supportWaiting } from "@/lib/queries/support";
import { useSupport } from "@/components/support/support-provider";
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
  {
    title: "Support",
    url: "/support-inbox",
    icon: icons.support,
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

// Pinned to the bottom for every role, as a row of icons; signing out is in the avatar's menu. "Help & support" opens
// the support modal (an email when chat support is off).
const navFooter: { title: string; url: string; icon: IconData; support?: boolean }[] = [
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
    url: SUPPORT_MAILTO,
    icon: icons.support,
    support: true,
  },
];

const FOOTER_ITEM =
  "grid size-10 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

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
  const { openSupport, enabled: supportEnabled } = useSupport();
  const responder = userRole === "ADMIN" || userRole === "SUPER_ADMIN";
  const { data: waiting } = useQuery({ ...supportWaiting, enabled: responder && supportEnabled });
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!responder) return;
    return onSupportEvent(() => void queryClient.invalidateQueries({ queryKey: supportWaiting.queryKey }));
  }, [responder, queryClient]);
  const withBadge = (items: typeof navAdmin) =>
    items.map((item) => (item.url === "/support-inbox" && waiting ? { ...item, badge: waiting } : item));

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
                ? withBadge(navSuperAdmin)
                : withBadge(navAdmin)
            }
          />
        )}
        {/*
          The callout stays in view at the foot of the sidebar while a long menu scrolls behind it (a fade shows there's
          more); scrolled to the end, every link sits above it. On a short screen it scrolls with the menu instead, so
          it never crowds the links out.
        */}
        <div className="relative mt-auto bg-sidebar px-2 pt-2 pb-2 before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-sidebar before:to-transparent [@media(min-height:640px)]:sticky [@media(min-height:640px)]:bottom-0 [&:not(:has(section))]:hidden">
          {/* Callouts are for customers only. */}
          <SidebarCallouts enabled={!isUserLoading && userRole === "CUSTOMER"} />
        </div>
      </SidebarContent>
      <SidebarFooter>
        <nav aria-label="More" className="flex items-center justify-around gap-1 border-t pt-2">
          {navFooter.map(({ title, url, icon, support }) => {
            if (support && supportEnabled) {
              return (
                <Tooltip key={title}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={title}
                      onClick={() => {
                        // The sheet and the modal would fight over focus: close the sheet first.
                        if (isMobile) setOpenMobile(false);
                        openSupport();
                      }}
                      className={FOOTER_ITEM}
                    >
                      <Icon icon={icon} size={20} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{title}</TooltipContent>
                </Tooltip>
              );
            }
            const active = pathname.startsWith(url);
            return (
              <Tooltip key={title}>
                <TooltipTrigger asChild>
                  <Link
                    href={url}
                    aria-label={title}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      FOOTER_ITEM,
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
