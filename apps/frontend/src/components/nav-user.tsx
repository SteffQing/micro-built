"use client";

import Link from "next/link";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon, icons, type IconData } from "@/components/icon";
import { UserAvatar } from "@/components/user-avatar";
import { useUserProvider } from "@/store/auth";
import { useSession } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { visibleEmail } from "@microbuilt/shared";
import { SUPPORT_HREF, reportProblem } from "@/lib/support";

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

type Shortcut = { label: string; view: string; icon: IconData };

// A few settings each role reaches for most, opened straight on their tab (/settings?view=).
const SHORTCUTS: Record<UserRole, Shortcut[]> = {
  SUPER_ADMIN: [
    { label: "Platform settings", view: "platform", icon: icons.sliders },
    { label: "Admin management", view: "admins", icon: icons.customers },
    { label: "2FA & passkeys", view: "authentication", icon: icons.fingerprint },
  ],
  ADMIN: [
    { label: "My profile", view: "profile", icon: icons.userCircle },
    { label: "Update password", view: "password", icon: icons.password },
    { label: "2FA & passkeys", view: "authentication", icon: icons.fingerprint },
  ],
  MARKETER: [
    { label: "My profile", view: "profile", icon: icons.userCircle },
    { label: "Update password", view: "password", icon: icons.password },
    { label: "2FA & passkeys", view: "authentication", icon: icons.fingerprint },
  ],
  CUSTOMER: [
    { label: "My profile", view: "profile", icon: icons.userCircle },
    { label: "Payment method", view: "payment", icon: icons.creditCard },
    { label: "2FA & passkeys", view: "authentication", icon: icons.fingerprint },
  ],
};

/** The avatar's menu: who is signed in, a few settings for their role, help, and signing out. */
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
  const { logout, userRole } = useUserProvider();
  const shortcuts = userRole ? SHORTCUTS[userRole] : [];

  return (
    <DropdownMenuContent align="end" sideOffset={8} className="w-60">
      <DropdownMenuLabel className="flex items-center gap-2.5 py-2 font-normal">
        <UserAvatar id={id} name={name} image={image} size={36} />
        <div className="grid min-w-0 flex-1 leading-tight">
          <span className="truncate text-sm font-medium">{name}</span>
          {email && <span className="truncate text-xs text-muted-foreground">{email}</span>}
          {role && <span className="truncate text-xs text-muted-foreground capitalize">{role}</span>}
        </div>
      </DropdownMenuLabel>
      {shortcuts.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {shortcuts.map(({ label, view, icon }) => (
              <DropdownMenuItem key={view} asChild>
                <Link href={`/settings?view=${view}`}>
                  <Icon icon={icon} size={16} /> {label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem asChild>
          <a href={SUPPORT_HREF}>
            <Icon icon={icons.support} size={16} /> Help &amp; support
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void reportProblem()}>
          <Icon icon={icons.alert} size={16} /> Report a problem
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onSelect={logout}>
        <Icon icon={icons.logout} size={16} /> Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
