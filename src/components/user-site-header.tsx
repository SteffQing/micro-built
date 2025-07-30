"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";
import { useUserProvider } from "@/store/auth";
import Notifications from "@/ui/modals/notifications";

export function UserSiteHeader() {
  const { user } = useUserProvider();

  return (
    <header className="flex bg-background py-4 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <div className="flex items-center gap-2 lg:hidden">
          <SidebarTrigger className="-ml-1 size-10" />
        </div>

        {user && <p className="font-medium text-sm md:text-xl">Welcome, {user.name.split(" ")[0]}</p>}

        <div className="ml-auto flex items-center gap-2">
          <Notifications />
          <NavUser />
        </div>
      </div>
    </header>
  );
}
