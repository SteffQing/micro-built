import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Explains why a control is disabled. A disabled button gets no pointer events, so the tooltip hangs off a
 * focusable wrapper instead; when `reason` is null the child renders as is.
 */
export function DisabledHint({ reason, children }: { reason: string | null; children: ReactNode }) {
  if (!reason) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label={reason} className="inline-flex cursor-not-allowed rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}
