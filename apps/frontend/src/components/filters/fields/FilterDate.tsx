"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface DateRange {
  start?: Date;
  end?: Date;
}

export interface FilterDateProps {
  label?: string;
  value?: DateRange;
  onChange: (value: DateRange) => void;
  placeholder?: string;
  className?: string;
  showPresets?: boolean;
}

const DATE_PRESETS = [
  {
    label: "Today",
    getValue: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { start: today, end: today };
    },
  },
  {
    label: "Yesterday",
    getValue: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      return { start: yesterday, end: yesterday };
    },
  },
  {
    label: "Last 7 Days",
    getValue: () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    },
  },
  {
    label: "This Month",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    },
  },
  {
    label: "Last Month",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    },
  },
  {
    label: "This Financial Year",
    getValue: () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const lastFYStart = new Date(currentYear, 0, 1);
      lastFYStart.setHours(0, 0, 0, 0);
      const lastFYEnd = new Date(currentYear, 11, 31);
      lastFYEnd.setHours(23, 59, 59, 999);
      return { start: lastFYStart, end: lastFYEnd };
    },
  },
  {
    label: "Last Financial Year",
    getValue: () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const lastFYStart = new Date(currentYear - 1, 0, 1);
      lastFYStart.setHours(0, 0, 0, 0);
      const lastFYEnd = new Date(currentYear - 1, 11, 31);
      lastFYEnd.setHours(23, 59, 59, 999);
      return { start: lastFYStart, end: lastFYEnd };
    },
  },
];

export const FilterDate = React.forwardRef<HTMLButtonElement, FilterDateProps>(
  (
    { label, value, onChange, placeholder, className, showPresets = true },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);

    const formatDateRange = (range?: DateRange) => {
      if (!range?.start && !range?.end)
        return placeholder || "Pick a date range";
      if (range.start && range.end) {
        if (range.start.getTime() === range.end.getTime()) {
          return format(range.start, "PPP");
        }
        return `${format(range.start, "PP")} - ${format(range.end, "PP")}`;
      }
      if (range.start) return `From ${format(range.start, "PP")}`;
      if (range.end) return `Until ${format(range.end, "PP")}`;
      return placeholder || "Pick a date range";
    };

    const handlePresetClick = (preset: (typeof DATE_PRESETS)[0]) => {
      onChange(preset.getValue());
      setOpen(false);
    };

    const handleCalendarSelect = (
      selected: { from?: Date; to?: Date } | undefined
    ) => {
      onChange({
        start: selected?.from,
        end: selected?.to,
      });
    };

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {label && <Label className="text-sm font-medium">{label}</Label>}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal h-13",
                !value?.start && !value?.end && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 size-4" />
              {formatDateRange(value)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex">
              {showPresets && (
                <div className="border-r p-3 space-y-1 min-w-[140px]">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Presets
                  </div>
                  {DATE_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-sm font-normal"
                      onClick={() => handlePresetClick(preset)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              )}
              <div className="p-3">
                <Calendar
                  mode="range"
                  selected={{
                    from: value?.start,
                    to: value?.end,
                  }}
                  onSelect={handleCalendarSelect}
                  numberOfMonths={2}
                  initialFocus
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

FilterDate.displayName = "FilterDate";
