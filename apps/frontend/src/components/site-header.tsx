"use client";
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import SearchInput from "./ui/search-input";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { NavUser } from "./nav-user";
// import { Icons } from "./icons";
import { ThemeToggle } from "./theme-toggle";
import { Badge } from "./ui/badge";
import { useState } from "react";

export function SiteHeader() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [notificationCount, setNotificationCount] = useState(
    initialNotifications.filter((n) => n.unread).length
  );
  const [isOpen, setIsOpen] = useState(false);
  const { state } = useSidebar();

  const handlePopoverOpen = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Clear notifications when popover opens
      setNotificationCount(0);
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, unread: false }))
      );
    }
  };
  return (
    <header className="flex bg-background py-4 h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        {state === "collapsed" && <SidebarTrigger className="-ml-1" />}
        <SearchInput />

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Popover open={isOpen} onOpenChange={handlePopoverOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Button variant="secondary" className="rounded-full relative">
                  <Icon icon={icons.notifications} size={16} />
                  {notificationCount > 0 && (
                    <Badge className="absolute bg-success rounded-full -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs text-success-foreground">
                      {notificationCount > 99 ? "99+" : notificationCount}
                    </Badge>
                  )}
                </Button>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 bg-background" align="end">
              <div className="p-4 border-b bg-muted/50">
                <div className="flex items-center gap-2">
                  <Icon icon={icons.notifications} size={16} className="text-muted-foreground" />
                  <h3 className="font-medium text-muted-foreground">
                    Notifications
                  </h3>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto bg-muted/50">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-4 border-b border-muted/50 last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center mt-1 flex-shrink-0">
                          <Icon icon={icons.dollarSign} size={16} className="text-success" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {notification.text}
                            {notification.name && (
                              <span className="font-medium text-muted-foreground">
                                {" "}
                                {notification.name}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
          <NavUser />
        </div>
      </div>
    </header>
  );
}

const initialNotifications = [
  {
    id: 1,
    text: "A new loan application has been requested from",
    name: "Jade Cole",
    time: "10:08 AM",
    unread: true,
  },
  {
    id: 2,
    text: "Jade Cole has submitted a loan application and its awaiting review.",
    name: null,
    time: "10:08 AM",
    unread: true,
  },
  {
    id: 3,
    text: "35 Loan applications are overdue review.",
    name: null,
    time: "10:08 AM",
    unread: true,
  },
];
