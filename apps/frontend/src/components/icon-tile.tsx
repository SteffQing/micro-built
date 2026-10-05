import { Icon, type IconData } from "@/components/icon";
import { cn } from "@/lib/utils";

// One icon language across the dashboard: a tinted tile with a line icon, toned by meaning.
const tileTone = {
  brand: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
} as const;

export function IconTile({ icon, tone = "brand", size = "md" }: { icon: IconData; tone?: keyof typeof tileTone; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg",
        size === "md" ? "size-10" : "size-8",
        tileTone[tone]
      )}
    >
      <Icon icon={icon} size={size === "md" ? 20 : 16} />
    </span>
  );
}
