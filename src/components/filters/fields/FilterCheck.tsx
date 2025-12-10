"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FilterCheckProps {
  label?: string;
  value?: boolean;
  onChange: (value: boolean) => void;
  description?: string;
  className?: string;
}

export const FilterCheck = React.forwardRef<
  HTMLButtonElement,
  FilterCheckProps
>(({ label, value, onChange, description, className }, ref) => {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-start space-x-3">
        <Checkbox
          ref={ref}
          checked={value || false}
          onCheckedChange={(checked) => onChange(checked === true)}
          id={`filter-check-${label}`}
        />
        <div className="grid gap-1.5 leading-none">
          {label && (
            <Label
              htmlFor={`filter-check-${label}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {label}
            </Label>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
});

FilterCheck.displayName = "FilterCheck";
