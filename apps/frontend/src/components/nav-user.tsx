"use client";

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Button } from "./ui/button";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { UserAvatar } from "@/components/user-avatar";
import { useUserProvider } from "@/store/auth";
import { useSession } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { visibleEmail } from "@microbuilt/shared";

export function NavUser() {
  const { user: profile, userRole } = useUserProvider();
  // The better-auth session lands before GET /user, so show who is signed in from it instead of a blank placeholder.
  const { data: session } = useSession();
  const user = profile ?? session?.user;

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex h-12 items-center gap-2 px-2" aria-busy aria-label="Loading account">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="hidden flex-1 space-y-1.5 sm:block">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <UserAvatar id={user.id} name={user.name} image={user.image} size={32} />
          <div className="hidden sm:grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user.name}</span>
            <span className="text-muted-foreground truncate text-xs">
              {!profile
                ? ""
                : userRole && userRole !== "CUSTOMER"
                ? userRole.split("_").join(" ")
                : (visibleEmail(user.email) ?? "")}
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
        <Button onClick={logout} variant="ghost" className="bg-destructive/10 hover:bg-destructive/20 text-destructive hover:text-destructive w-full">
          <Icon icon={icons.logout} size={20} /> Logout
        </Button>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
