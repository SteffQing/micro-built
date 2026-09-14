"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type MonthPickerProps = {
  value: string;
  onChange: (value: string) => void;
  viewYear: number;
  onViewYearChange: (year: number) => void;
};

export function MonthPicker({
  value,
  onChange,
  viewYear,
  onViewYearChange,
}: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const current = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    timeZone: "Africa/Lagos",
  }).formatToParts(new Date());
  const currentYear = Number(current.find((part) => part.type === "year")!.value);
  const currentMonth = Number(current.find((part) => part.type === "month")!.value);
  const displayYear = Math.min(viewYear, currentYear);
  const selected = useMemo(() => {
    if (!value) return null;
    const [year, month] = value.split("-").map(Number);
    return { year, month };
  }, [value]);

  const label = selected
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(selected.year, selected.month - 1, 1)))
    : "Select month";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          {label}
          <CalendarDays className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous year"
            onClick={() => onViewYearChange(displayYear - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm font-semibold">{displayYear}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next year"
            disabled={displayYear >= currentYear}
            onClick={() => onViewYearChange(displayYear + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {months.map((month, index) => {
            const active =
              selected?.year === displayYear && selected.month === index + 1;
            const future = displayYear === currentYear && index + 1 > currentMonth;
            return (
              <Button
                key={month}
                type="button"
                size="sm"
                variant={active ? "default" : "ghost"}
                disabled={future}
                onClick={() => {
                  if (future) return;
                  onChange(`${displayYear}-${String(index + 1).padStart(2, "0")}`);
                  setOpen(false);
                }}
              >
                {month}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
