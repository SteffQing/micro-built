import { cn } from "@/lib/utils";
import { JSX, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  title: string;
  icon: JSX.Element;
  value: string;
  className?: string;
  loading?: boolean;
  description?: string;
}

export default function ReportCard({
  title,
  icon,
  value,
  className,
  loading = false,
  description,
}: Props) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-[12px] p-4 lg:p-5 flex flex-col gap-2 w-full relative",
        className
      )}
    >
      {description && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`About ${title}`}
              className="absolute right-3 top-3 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon icon={icons.info} size={16} aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 leading-5">
            {description}
          </TooltipContent>
        </Tooltip>
      )}
      <span className="mb-4 lg:mb-5">{icon}</span>
      <LoadReportValue loading={loading} value={value} />
      <p className="text-muted-foreground text-sm font-normal">{title}</p>
    </div>
  );
}

function LoadReportValue({ loading, value, className = "" }: Omit<Props, "title" | "icon">) {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 300);

    return () => clearInterval(interval);
  }, [loading]);

  return (
    <h3 className={`text-foreground text-2xl font-semibold ${className}`}>
      {loading ? (
        <span className="inline-block min-w-[4ch]">
          {"•".repeat(dotCount)}
          <span className="opacity-30">{"•".repeat(3 - dotCount)}</span>
        </span>
      ) : (
        value
      )}
    </h3>
  );
}
