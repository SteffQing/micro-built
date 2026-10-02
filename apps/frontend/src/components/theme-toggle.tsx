"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const themes = [
  { value: "light", label: "Light", icon: icons.sun },
  { value: "dark", label: "Dark", icon: icons.moon },
  { value: "system", label: "System", icon: icons.monitor },
] as const;

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const resolvedIconData =
    themes.find((t) => t.value === resolvedTheme)?.icon ?? icons.sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Toggle theme"
        >
          {mounted ? (
            <Icon icon={resolvedIconData} size={16} />
          ) : (
            <Icon icon={icons.sun} size={16} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map(({ value, label, icon: iconData }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className="justify-between"
          >
            <span className="flex items-center gap-2">
              <Icon icon={iconData} size={16} />
              {label}
            </span>
            {resolvedTheme === value && (
              <span className="text-xs text-muted-foreground">Active</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
