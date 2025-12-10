"use client";

import * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FilterIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface FilterContainerPopoverProps {
  children: React.ReactNode;
  onApply?: () => void;
  onClear?: () => void;
  title?: string;
  description?: string;
  triggerLabel?: string;
  applyLabel?: string;
  clearLabel?: string;
  className?: string;
  activeFiltersCount?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

export const FilterContainerPopover = React.forwardRef<
  HTMLDivElement,
  FilterContainerPopoverProps
>(
  (
    {
      children,
      onApply,
      onClear,
      title = "Filters",
      description,
      triggerLabel = "Filters",
      applyLabel = "Apply Filters",
      clearLabel = "Clear All",
      className,
      activeFiltersCount = 0,
      open,
      onOpenChange,
      align = "start",
      side = "bottom",
    },
    ref
  ) => {
    const [internalOpen, setInternalOpen] = React.useState(false);
    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : internalOpen;
    const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

    const handleApply = () => {
      onApply?.();
      setIsOpen?.(false);
    };

    const handleClear = () => {
      onClear?.();
    };

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative">
            <FilterIcon className="mr-2 size-4" />
            {triggerLabel}
            {activeFiltersCount > 0 && (
              <Badge
                variant="default"
                className="ml-2 size-5 flex items-center justify-center p-0 rounded-full text-xs"
              >
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          side={side}
          className="w-[400px] p-0"
          sideOffset={8}
        >
          <div ref={ref} className={cn("flex flex-col", className)}>
            {/* Header */}
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{title}</h3>
                  {description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 -mr-2"
                  onClick={() => setIsOpen?.(false)}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="max-h-[500px]">
              <div className="p-4 space-y-6">{children}</div>
            </ScrollArea>

            {/* Footer */}
            <div className="border-t p-4 flex gap-2">
              <Button
                variant="outline"
                onClick={handleClear}
                className="flex-1"
                disabled={activeFiltersCount === 0}
              >
                {clearLabel}
              </Button>
              <Button onClick={handleApply} className="flex-1">
                {applyLabel}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }
);

FilterContainerPopover.displayName = "FilterContainerPopover";
