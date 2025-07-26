"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { logout } from "@/store/auth";
import { useUserProvider } from "@/store/auth";
import { AVATAR_HOST } from "@/config/constants";

export function NavUser() {
  const { user, userRole } = useUserProvider();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Avatar className="h-8 w-8 rounded-full">
            <AvatarImage src={AVATAR_HOST + user?.id} alt={user?.name} />
            <AvatarFallback>
              {user?.id
                .split("-")
                .map((part) => part[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user?.name}</span>
            <span className="text-muted-foreground truncate text-xs">{userRole?.split("_").join(" ") || ""}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function NavUserLogout() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Button onClick={() => logout()} variant="destructive" className="bg-destructive/40 text-destructive w-full">
          <LogOut className="w-5 h-4" /> Logout
        </Button>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
