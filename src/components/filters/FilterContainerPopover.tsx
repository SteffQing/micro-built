"use client";

import * as React from "react";
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
    },
    ref
  ) => {
    const [internalOpen, setInternalOpen] = React.useState(false);
    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : internalOpen;
    const setIsOpen = isControlled ? onOpenChange : setInternalOpen;
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleApply = () => {
      onApply?.();
      setIsOpen?.(false);
    };

    const handleClear = () => {
      onClear?.();
    };

    const toggleOpen = () => {
      setIsOpen?.(!isOpen);
    };

    // Close on outside click
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsOpen?.(false);
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen, setIsOpen]);

    return (
      <div ref={containerRef} className="w-full z-10">
        <Button
          variant="outline"
          className="relative w-full"
          onClick={toggleOpen}
        >
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

        {/* Drawer Sheet */}
        <div
          className={cn(
            "absolute top-[calc(100%+10px)] left-0 right-0 bg-background border rounded-md shadow-lg overflow-hidden transition-all duration-300 ease-in-out z-50",
            isOpen
              ? "opacity-100 translate-y-0 max-h-[600px]"
              : "opacity-0 -translate-y-2 max-h-0 pointer-events-none"
          )}
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
            <ScrollArea className="max-h-[400px]">
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
        </div>
      </div>
    );
  }
);

FilterContainerPopover.displayName = "FilterContainerPopover";
