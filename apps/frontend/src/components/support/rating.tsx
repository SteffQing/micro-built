"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Icon, icons } from "@/components/icon";
import { rateSupportMessage } from "@/lib/mutations/support";
import { cn } from "@/lib/utils";

/** Thumbs up or down on a finished reply, optimistic. A thumbs down asks the chat to offer the team. */
export function Rating({
  messageId,
  initial,
  onDown,
}: {
  messageId: string;
  initial?: SupportRating | null;
  onDown?: () => void;
}) {
  const [rating, setRating] = useState<SupportRating | null>(initial ?? null);
  const rate = useMutation(rateSupportMessage);

  const choose = (value: SupportRating) => {
    setRating(value);
    rate.mutate({ id: messageId, rating: value });
    if (value === "DOWN") onDown?.();
  };

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Was this helpful?">
      {(
        [
          ["UP", icons.thumbsUp, "Helpful"],
          ["DOWN", icons.thumbsDown, "Not helpful"],
        ] as const
      ).map(([value, icon, label]) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={rating === value}
          onClick={() => choose(value)}
          className={cn(
            "grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            rating === value && "text-brand"
          )}
        >
          <Icon icon={icon} size={14} />
        </button>
      ))}
    </div>
  );
}
