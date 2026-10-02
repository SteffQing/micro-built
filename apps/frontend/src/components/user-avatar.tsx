"use client";

import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import notionistsNeutral from "@dicebear/styles/notionists-neutral.json" with { type: "json" };
import { Style, Avatar as DiceBearAvatar } from "@dicebear/core";

const style = new Style(notionistsNeutral);

function dicebearDataUri(seed: string): string {
  return new DiceBearAvatar(style, { seed, size: 128 }).toDataUri();
}

interface UserAvatarProps {
  id?: string;
  name?: string;
  image?: string | null;
  size?: number;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({
  id,
  name,
  image,
  size = 40,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const initials = useMemo(() => {
    if (name) {
      return name
        .split(" ")
        .map((w) => w.charAt(0))
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (id) {
      return id
        .split("-")
        .map((w) => w.charAt(0))
        .join("")
        .slice(0, 2);
    }
    return "MB";
  }, [name, id]);

  const dicebearSrc = useMemo(
    () => (id ? dicebearDataUri(id) : undefined),
    [id],
  );

  return (
    <Avatar
      className={cn(className)}
      style={{ width: size, height: size }}
    >
      <AvatarImage src={image || dicebearSrc} alt={name ?? "User"} />
      <AvatarFallback
        className={cn("bg-brand text-brand-foreground font-semibold", fallbackClassName)}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
