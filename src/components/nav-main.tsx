"use client";

import { type Icon } from "@tabler/icons-react";

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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: Icon;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleParentClick = (
    url: string,
    hasSubItems: boolean,
    e: React.MouseEvent
  ) => {
    // If clicking on the chevron area, don't navigate
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
            const isParentActive = pathname === item.url;
            const hasActiveChild = item.items?.some(
              (subItem) => pathname === subItem.url
            );
            const isExpanded = isParentActive || hasActiveChild;
            const isActive = isParentActive || hasActiveChild;

            // If item has sub-items, render as collapsible
            if (item.items && item.items.length > 0) {
              return (
                <Collapsible
                  key={item.title}
                  defaultOpen={isExpanded}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <div className="relative">
                      <SidebarMenuButton
                        tooltip={item.title}
                        onClick={(e) => handleParentClick(item.url, true, e)}
                        className={`p-4 cursor-pointer ${
                          isActive ? "bg-primary text-white" : ""
                        }`}
                      >
                        {item.icon && (
                          <item.icon
                            className={`h-8 w-8 ${
                              isActive ? "text-white fill-primary" : ""
                            }`}
                          />
                        )}
                        <span
                          className={`text-muted-foreground font-normal ${
                            isActive ? "text-white" : ""
                          }`}
                        >
                          {item.title}
                        </span>
                      </SidebarMenuButton>

                      <CollapsibleTrigger asChild>
                        <button
                          data-chevron
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </button>
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent>
                      <SidebarMenuSub className="space-y-3">
                        {item.items.map((subItem) => {
                          const isSubItemActive = pathname === subItem.url;
                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                onClick={() => router.push(subItem.url)}
                                className={`cursor-pointer ${
                                  isSubItemActive
                                    ? "bg-primary text-white font-medium border border-primary"
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
            const isActiveRegular = pathname === item.url;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  onClick={() => router.push(item.url)}
                  className={`p-4 ${
                    isActiveRegular
                      ? "border-t-2 border-l-2 bg-primary hover:bg-primary/60 text-white -mr-8 pr-4 translate-x-2 relative"
                      : ""
                  }`}
                >
                  {item.icon && (
                    <item.icon
                      className={`h-8 w-8 ${
                        isActiveRegular ? "text-white fill-primary" : ""
                      }`}
                    />
                  )}
                  <span
                    className={`text-muted-foreground font-normal ${
                      isActiveRegular ? "text-white" : ""
                    }`}
                  >
                    {item.title}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
