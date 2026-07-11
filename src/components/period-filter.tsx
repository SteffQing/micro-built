"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Empty `from`/`to` means all-time. Outstanding is a live snapshot and ignores
// this range (see API).
type Props = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
};

const ISO = "yyyy-MM-dd";
const toDate = (value: string) => (value ? parse(value, ISO, new Date()) : undefined);
const toISO = (date: Date | undefined) => (date ? format(date, ISO) : "");

const presets: { label: string; range: () => DateRange }[] = [
  { label: "Today", range: () => ({ from: new Date(), to: new Date() }) },
  { label: "Last 7 days", range: () => ({ from: daysAgo(6), to: new Date() }) },
  { label: "Last 30 days", range: () => ({ from: daysAgo(29), to: new Date() }) },
  { label: "Month to date", range: () => ({ from: startOfMonth(0), to: new Date() }) },
  { label: "Last month", range: () => ({ from: startOfMonth(-1), to: endOfMonth(-1) }) },
  { label: "Year to date", range: () => ({ from: new Date(new Date().getFullYear(), 0, 1), to: new Date() }) },
];

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function startOfMonth(offset: number) {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + offset, 1);
}

function endOfMonth(offset: number) {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + offset + 1, 0);
}

export default function PeriodFilter({ from, to, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const selected: DateRange | undefined = from || to ? { from: toDate(from), to: toDate(to) } : undefined;

  const label = selected?.from
    ? `${format(selected.from, "d MMM yyyy")}${selected.to ? ` – ${format(selected.to, "d MMM yyyy")}` : ""}`
    : "All time";

  const select = (range: DateRange | undefined) => onChange(toISO(range?.from), toISO(range?.to));

  return (
    <div className="flex w-full items-center gap-2 text-sm sm:w-auto">
      <span className="shrink-0 text-xs text-[#999]">Date:</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 w-full justify-start gap-2 rounded-md border-[#e8e8e8] bg-[#fafafa] px-3 text-xs font-normal sm:w-auto sm:min-w-56",
              !selected?.from && "text-[#999]"
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-[#999]" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="max-h-[80vh] w-auto overflow-y-auto p-0">
          <div className="flex max-sm:flex-col">
            <div className="flex flex-col gap-0.5 border-b p-2 sm:w-36 sm:border-b-0 sm:border-e">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start font-normal"
                  onClick={() => {
                    select(preset.range());
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={selected?.from}
              selected={selected}
              onSelect={select}
              disabled={{ after: new Date() }}
              className="p-2"
            />
          </div>
        </PopoverContent>
      </Popover>
      {(from || to) && (
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-[#999]"
          aria-label="Clear date range"
          onClick={() => onChange("", "")}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
