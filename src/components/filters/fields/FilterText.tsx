"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterTextProps {
  label?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showSearchIcon?: boolean;
}

export const FilterText = React.forwardRef<HTMLInputElement, FilterTextProps>(
  (
    { label, value, onChange, placeholder, className, showSearchIcon = true },
    ref
  ) => {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {label && <Label className="text-sm font-medium">{label}</Label>}
        <div className="relative">
          {showSearchIcon && (
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          )}
          <Input
            ref={ref}
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "Search..."}
            className={cn(showSearchIcon && "pl-9")}
          />
        </div>
      </div>
    );
  }
);

FilterText.displayName = "FilterText";
