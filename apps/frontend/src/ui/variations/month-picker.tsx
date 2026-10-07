"use client";

import { useMemo, useState } from "react";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addMonths, currentLagosMonth, monthTitle } from "@/lib/payroll/variations";
import { cn } from "@/lib/utils";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type MonthPickerProps = {
  /** YYYY-MM */
  value: string;
  onChange: (value: string) => void;
  /**
   * How many months past the current Lagos month can be picked. Variations are generated during the month, and the
   * next month already has deductions once this one has gone to the organization.
   */
  monthsAhead?: number;
  className?: string;
};

export function MonthPicker({ value, onChange, monthsAhead = 2, className }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const latest = useMemo(() => addMonths(currentLagosMonth(), monthsAhead), [monthsAhead]);
  const latestYear = Number(latest.slice(0, 4));
  const latestMonth = Number(latest.slice(5, 7));
  const selected = useMemo(() => {
    const [year, month] = value.split("-").map(Number);
    return { year, month };
  }, [value]);
  const displayYear = Math.min(pickedYear ?? selected.year, latestYear);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Each time it opens it starts on the selected month's year again.
        if (next) setPickedYear(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("w-full justify-between font-normal", className)}>
          {monthTitle(value)}
          <Icon icon={icons.calendarDays} size={16} className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous year"
            onClick={() => setPickedYear(displayYear - 1)}
          >
            <Icon icon={icons.chevronLeft} size={16} />
          </Button>
          <span className="text-sm font-semibold">{displayYear}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next year"
            disabled={displayYear >= latestYear}
            onClick={() => setPickedYear(displayYear + 1)}
          >
            <Icon icon={icons.chevronRight} size={16} />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {months.map((month, index) => {
            const active = selected.year === displayYear && selected.month === index + 1;
            const beyond = displayYear === latestYear && index + 1 > latestMonth;
            return (
              <Button
                key={month}
                type="button"
                size="sm"
                variant={active ? "default" : "ghost"}
                disabled={beyond}
                onClick={() => {
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
