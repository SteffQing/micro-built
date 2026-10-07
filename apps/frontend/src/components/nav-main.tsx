"use client";

import { type IconData, Icon, icons } from "@/components/icon";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePathname, useRouter } from "next/navigation";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: IconData;
    /** A count shown at the end of the row (unread notifications). */
    badge?: number;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  // A mailto: link (support) leaves the app rather than routing inside it.
  const go = (url: string) => (url.includes(":") ? window.location.assign(url) : router.push(url));

  const handleParentClick = (url: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isChevronClick = target.closest("[data-chevron]");

    if (!isChevronClick) {
      router.push(url);
    }
  };

  return (
    <SidebarGroup className="pr-0">
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu className="space-y-1 overflow-hidden">
          {items.map((item) => {
            // Check if current path matches this item or any of its sub-items
            const isParentActive = pathname.startsWith(item.url);
            const hasActiveChild = item.items?.some((subItem) => pathname.startsWith(subItem.url));
            const isExpanded = isParentActive || hasActiveChild;
            const isActive = isParentActive || hasActiveChild;

            // If item has sub-items, render as collapsible
            if (item.items && item.items.length > 0) {
              return (
                <Collapsible key={item.title} defaultOpen={isExpanded} className="group/collapsible">
                  <SidebarMenuItem>
                    <div className="relative">
                      <SidebarMenuButton
                        tooltip={item.title}
                        onClick={(e) => handleParentClick(item.url, e)}
                        className={`p-4 cursor-pointer ${isActive ? "bg-primary text-primary-foreground" : ""}`}
                      >
                        {item.icon && <Icon icon={item.icon} size={32} className={isActive ? "text-primary-foreground fill-primary" : ""} />}
                        <span className={`text-muted-foreground font-normal ${isActive ? "text-primary-foreground" : ""}`}>
                          {item.title}
                        </span>
                      </SidebarMenuButton>

                      <CollapsibleTrigger asChild>
                        <button
                          data-chevron
                          aria-label={`Toggle ${item.title} menu`}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Icon icon={icons.chevronRight} size={16} className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </button>
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent>
                      <SidebarMenuSub className="space-y-3">
                        {item.items.map((subItem) => {
                          const isSubItemActive = pathname.startsWith(subItem.url);
                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                onClick={() => router.push(subItem.url)}
                                className={`cursor-pointer ${
                                  isSubItemActive
                                    ? "bg-primary text-primary-foreground font-medium border border-primary"
                                    : "text-muted-foreground"
                                }`}
                                isActive={isSubItemActive}
                              >
                                <span>{subItem.title}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            }

            // Regular menu item without sub-items
            const isActiveRegular = pathname.startsWith(item.url);
            const badge = item.badge ? (item.badge > 99 ? "99+" : String(item.badge)) : null;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  onClick={() => go(item.url)}
                  aria-label={badge ? `${item.title}, ${badge} unread` : undefined}
                  className={`p-4 ${
                    isActiveRegular
                      ? "border-t-2 border-l-2 bg-primary hover:bg-primary/60 text-primary-foreground -mr-8 pr-4 translate-x-2 relative"
                      : ""
                  }`}
                >
                  {item.icon && <Icon icon={item.icon} size={32} className={isActiveRegular ? "text-primary-foreground fill-primary" : ""} />}
                  <span className={`text-muted-foreground font-normal ${isActiveRegular ? "text-primary-foreground" : ""}`}>
                    {item.title}
                  </span>
                  {badge && (
                    <span
                      aria-hidden
                      className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                        isActiveRegular ? "mr-6 bg-primary-foreground text-primary" : "bg-brand text-brand-foreground"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
