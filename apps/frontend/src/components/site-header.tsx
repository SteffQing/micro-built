"use client";
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import SearchInput from "./ui/search-input";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { NavUser } from "./nav-user";
import { ThemeToggle } from "./theme-toggle";
import Notifications from "@/ui/modals/notifications";

export function SiteHeader() {
  const { state } = useSidebar();

  return (
    <header className="flex bg-background py-4 h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        {state === "collapsed" && <SidebarTrigger className="-ml-1" />}
        <SearchInput />

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Notifications />
          <NavUser />
        </div>
      </div>
    </header>
  );
}
