"use client";

import * as React from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { FilterIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface FilterContainerProps {
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

export const FilterContainer = React.forwardRef<
  HTMLDivElement,
  FilterContainerProps
>(
  (
    {
      children,
      onApply,
      onClear,
      title = "Filters",
      description = "Apply filters to refine your results",
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

    const handleApply = () => {
      onApply?.();
      setIsOpen?.(false);
    };

    const handleClear = () => {
      onClear?.();
    };

    return (
      <Drawer direction="top" open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
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
        </DrawerTrigger>
        <DrawerContent className="max-w-md">
          <div ref={ref} className={cn("flex flex-col h-full", className)}>
            <DrawerHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <DrawerTitle>{title}</DrawerTitle>
                  <DrawerDescription>{description}</DrawerDescription>
                </div>
                <DrawerClose asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <XIcon className="size-4" />
                  </Button>
                </DrawerClose>
              </div>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {children}
            </div>

            <DrawerFooter className="border-t flex-row gap-2">
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
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
);

FilterContainer.displayName = "FilterContainer";
export default FilterContainer;
