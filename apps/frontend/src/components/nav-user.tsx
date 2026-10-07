"use client";

import Link from "next/link";
import { toast } from "sonner";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { UserAvatar } from "@/components/user-avatar";
import { useUserProvider } from "@/store/auth";
import { useSession } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { visibleEmail } from "@microbuilt/shared";
import {
  enablePopups,
  playChime,
  popupPermission,
  setAlertPrefs,
  useAlertPrefs,
  type PopupPermission,
} from "@/lib/notification-alerts";
import { SUPPORT_HREF } from "@/lib/support";

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

  const role = !profile
    ? ""
    : userRole && userRole !== "CUSTOMER"
    ? userRole.split("_").join(" ").toLowerCase()
    : "";
  const email = visibleEmail(user.email) ?? "";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label="Account menu"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar id={user.id} name={user.name} image={user.image} size={32} />
              <div className="hidden sm:grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs capitalize">{role || email}</span>
              </div>
              <Icon icon={icons.chevronDown} size={14} className="hidden text-muted-foreground sm:block" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <AccountMenu name={user.name} email={email} role={role} id={user.id} image={user.image} />
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

const POPUP_HINT: Record<PopupPermission, string> = {
  granted: "When the app is in the background",
  default: "When the app is in the background",
  denied: "Blocked in your browser settings",
  unsupported: "Not supported in this browser",
};

/** The avatar's menu: who is signed in, their settings, how notifications reach them, help, and signing out. */
function AccountMenu({
  id,
  name,
  email,
  role,
  image,
}: {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string | null;
}) {
  const { logout } = useUserProvider();
  const prefs = useAlertPrefs();
  // Read when the menu renders: the browser's answer can change in its own settings.
  const permission = popupPermission();
  const popupsOn = prefs.popups && permission === "granted";

  const togglePopups = async () => {
    if (popupsOn) return setAlertPrefs({ popups: false });
    const result = await enablePopups();
    if (result === "denied") toast.error("Pop-ups are blocked for this site. Allow notifications in your browser settings.");
    else if (result === "unsupported") toast.error("This browser can't show notification pop-ups.");
    else if (result === "granted") toast.success("You'll get a pop-up for new notifications while you're away.");
  };

  return (
    <DropdownMenuContent align="end" sideOffset={8} className="w-64">
      <DropdownMenuLabel className="flex items-center gap-2.5 py-2 font-normal">
        <UserAvatar id={id} name={name} image={image} size={36} />
        <div className="grid min-w-0 flex-1 leading-tight">
          <span className="truncate text-sm font-medium">{name}</span>
          {email && <span className="truncate text-xs text-muted-foreground">{email}</span>}
          {role && <span className="truncate text-xs text-muted-foreground capitalize">{role}</span>}
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Icon icon={icons.settings} size={16} /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/notifications">
            <Icon icon={icons.notifications} size={16} /> Notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">New notifications</DropdownMenuLabel>
      <DropdownMenuCheckboxItem
        checked={prefs.sound}
        // Keep the menu open so the change is visible.
        onSelect={(e) => e.preventDefault()}
        onCheckedChange={(sound) => {
          setAlertPrefs({ sound });
          if (sound) playChime();
        }}
      >
        <Icon icon={icons.sound} size={16} className="text-muted-foreground" />
        Play a sound
      </DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem
        checked={popupsOn}
        disabled={permission === "unsupported"}
        onSelect={(e) => e.preventDefault()}
        onCheckedChange={() => void togglePopups()}
        className="items-start"
      >
        <Icon icon={icons.popup} size={16} className="mt-0.5 text-muted-foreground" />
        <span className="grid leading-tight">
          Browser pop-ups
          <span className="text-xs text-muted-foreground">{POPUP_HINT[permission]}</span>
        </span>
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <a href={SUPPORT_HREF}>
          <Icon icon={icons.support} size={16} /> Help &amp; support
        </a>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onSelect={logout}>
        <Icon icon={icons.logout} size={16} /> Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
