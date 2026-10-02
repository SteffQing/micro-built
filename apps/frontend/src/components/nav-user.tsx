"use client";

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Button } from "./ui/button";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { UserAvatar } from "@/components/user-avatar";
import { useUserProvider } from "@/store/auth";
import { visibleEmail } from "@microbuilt/shared";

export function NavUser() {
  const { user, userRole } = useUserProvider();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <UserAvatar id={user?.id} name={user?.name} size={32} />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium hidden sm:block">{user?.name}</span>
            <span className="text-muted-foreground truncate text-xs">
              {userRole && userRole !== "CUSTOMER"
                ? userRole.split("_").join(" ")
                : (visibleEmail(user?.email) ?? "")}
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function NavUserLogout() {
  const { logout } = useUserProvider();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Button onClick={logout} variant="destructive" className="bg-destructive/40 text-destructive w-full">
          <Icon icon={icons.logout} size={20} /> Logout
        </Button>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
