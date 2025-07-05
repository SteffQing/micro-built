"use client";

import {
  IconCreditCard,
  IconLogout,
  IconNotification,
  IconUserCircle,
} from "@tabler/icons-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "./ui/button";
import { ChevronDown, LogOut } from "lucide-react";
import { logout } from "@/store/auth";
// import { useAuthStore } from "@/store/auth";

export function NavUser() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-full grayscale">
                {/* <AvatarImage src={user?.profile.avatar || ""} alt={user?.profile.name || ""} /> */}
                <AvatarFallback className="rounded-full">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                {/* <span className="truncate font-medium">{user.name}</span> */}
                <span className="text-muted-foreground truncate text-xs">
                  {/* {user?.profile?.name || ""} */}
                </span>
              </div>
              <div className="bg-muted rounded-full p-2">
                <ChevronDown className="ml-auto size-4" />
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side="bottom"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {/* <AvatarImage src={user?.profile.avatar || ""} alt={user?.profile.name || ""} /> */}
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  {/* <span className="truncate font-medium">{user?.profile.name || ""}</span> */}
                  <span className="text-muted-foreground truncate text-xs">
                    {/* {user?.profile.email || ""} */}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <IconUserCircle />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <IconCreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <IconNotification />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <IconLogout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function NavUserLogout() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Button
          onClick={() => logout()}
          variant="destructive"
          className="bg-destructive/40 text-destructive w-full"
        >
          <LogOut className="w-5 h-4" /> Logout
        </Button>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
