import { Icon, icons } from "@/components/icon";
import { cn } from "@/lib/utils";

/** What the support assistant is called. */
export const ASSISTANT_NAME = "Prime";

/** Prime's mark: a brand gradient with the sparkles, and an "AI" tag so it never passes for a person. */
export function PrimeAvatar({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      title={`${ASSISTANT_NAME}, the AI assistant`}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <span className="grid size-full place-items-center rounded-full bg-gradient-to-br from-brand to-chart-2 text-brand-foreground shadow-xs">
        <Icon icon={icons.sparkles} size={Math.round(size * 0.5)} />
      </span>
      <span className="absolute -right-1 -bottom-1 rounded-full border border-card bg-foreground px-[3px] text-[8px] leading-[11px] font-bold tracking-wide text-background">
        AI
      </span>
    </span>
  );
}
