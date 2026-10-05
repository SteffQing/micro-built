"use client";

import * as React from "react";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PeriodRangeValue {
  from: string; // YYYY-MM or "" (all time)
  to: string; // YYYY-MM or "" (all time)
}

export interface PeriodRangeFilterProps {
  value: PeriodRangeValue;
  onChange: (value: PeriodRangeValue) => void;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers (all periods are YYYY-MM strings, which sort lexically)     */
/* ------------------------------------------------------------------ */

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const EMPTY: PeriodRangeValue = { from: "", to: "" };

const ym = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

function parts(value: string) {
  const [y, m] = value.split("-").map(Number);
  return { year: y, month: m };
}

/** Current year/month in Africa/Lagos. */
function currentYm(): string {
  const lagos = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    timeZone: "Africa/Lagos",
  }).formatToParts(new Date());
  const year = Number(lagos.find((p) => p.type === "year")!.value);
  const month = Number(lagos.find((p) => p.type === "month")!.value);
  return ym(year, month);
}

function shift(value: string, months: number): string {
  const { year, month } = parts(value);
  const total = year * 12 + (month - 1) + months;
  return ym(Math.floor(total / 12), (total % 12) + 1);
}

function monthLabel(value: string, withYear = true) {
  const { year, month } = parts(value);
  const name = SHORT_MONTHS[month - 1];
  return withYear ? `${name} ${year}` : name;
}

function rangeLabel(r: PeriodRangeValue): string {
  if (!r.from && !r.to) return "All time";
  if (r.from && r.to && r.from === r.to) return monthLabel(r.from);
  if (r.from && r.to) {
    const a = parts(r.from);
    const b = parts(r.to);
    if (a.year === b.year) {
      return `${monthLabel(r.from, false)} – ${monthLabel(r.to)}`;
    }
    return `${monthLabel(r.from)} – ${monthLabel(r.to)}`;
  }
  const fromLabel = r.from ? monthLabel(r.from) : "Start";
  const toLabel = r.to ? monthLabel(r.to) : "Now";
  return `${fromLabel} – ${toLabel}`;
}

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function absMonth(value: string): number {
  const { year, month } = parts(value);
  return year * 12 + month - 1;
}

/**
 * Coerces any pair into a valid range: months are compared as absolute
 * year*12+month (across years), swapped so from <= to, and a lone month
 * (from-only or to-only) becomes a single-month range. Never returns
 * to < from or a to without a from. Empty/invalid input is "all time".
 */
export function normaliseRange(a: string, b: string): PeriodRangeValue {
  const va = YM_RE.test(a) ? a : "";
  const vb = YM_RE.test(b) ? b : "";
  const first = va || vb;
  const second = vb || va;
  if (!first) return EMPTY;
  return absMonth(first) <= absMonth(second)
    ? { from: first, to: second }
    : { from: second, to: first };
}

const sorted = normaliseRange;

/* ------------------------------------------------------------------ */
/*  Presets                                                             */
/* ------------------------------------------------------------------ */

type Preset = { label: string; range: () => PeriodRangeValue };

const presets: Preset[] = [
  { label: "All time", range: () => EMPTY },
  {
    label: "This month",
    range: () => {
      const now = currentYm();
      return { from: now, to: now };
    },
  },
  {
    label: "Last month",
    range: () => {
      const last = shift(currentYm(), -1);
      return { from: last, to: last };
    },
  },
  {
    label: "Last 3 months",
    range: () => {
      const now = currentYm();
      return { from: shift(now, -2), to: now };
    },
  },
  {
    label: "This year",
    range: () => {
      const now = currentYm();
      return { from: `${parts(now).year}-01`, to: now };
    },
  },
  {
    label: "Last year",
    range: () => {
      const y = parts(currentYm()).year - 1;
      return { from: `${y}-01`, to: `${y}-12` };
    },
  },
];

/* ------------------------------------------------------------------ */
/*  PeriodRangeFilter                                                   */
/* ------------------------------------------------------------------ */

export default function PeriodRangeFilter({
  value,
  onChange,
  className,
}: PeriodRangeFilterProps) {
  const [open, setOpen] = React.useState(false);

  // Local draft while the popover is open; committed on Apply.
  const [draft, setDraft] = React.useState<PeriodRangeValue>(value);
  // First click of a range is held here until the second click arrives.
  const [anchor, setAnchor] = React.useState<string | null>(null);
  const [hover, setHover] = React.useState<string | null>(null);
  const [viewYear, setViewYear] = React.useState(() => parts(currentYm()).year);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(normaliseRange(value.from, value.to));
      setAnchor(null);
      setHover(null);
      setViewYear(parts(value.to || value.from || currentYm()).year);
    }
    setOpen(next);
  };

  const now = currentYm();
  const nowYear = parts(now).year;
  const isActive = !!(value.from || value.to);

  // Range shown in the grid: live preview while picking the second month.
  const shown: PeriodRangeValue =
    anchor && hover ? sorted(anchor, hover) : draft;
  const hasShown = !!(shown.from || shown.to);
  const lo = shown.from || "0000-00";
  const hi = shown.to || "9999-99";

  const pick = (month: string) => {
    if (!anchor) {
      setAnchor(month);
      setDraft({ from: month, to: month });
    } else {
      setDraft(sorted(anchor, month));
      setAnchor(null);
      setHover(null);
    }
  };

  const commit = (next: PeriodRangeValue) => {
    onChange(next);
    setOpen(false);
  };

  const summary = anchor
    ? "Select an end month"
    : hasShown
      ? rangeLabel(draft)
      : "All time";

  const label = rangeLabel(value);

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-label={`Period: ${label}`}
            className={cn(
              "h-9 justify-start gap-2 rounded-full bg-background px-3 text-xs font-normal",
              isActive ? "pe-9" : "pe-4"
            )}
          >
            <Icon
              icon={icons.calendar}
              size={16}
              className="shrink-0 text-muted-foreground"
            />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-[min(22rem,calc(100vw-1.5rem))] p-0"
        >
          {/* Presets */}
          <div className="flex flex-wrap gap-1.5 border-b p-3">
            {presets.map((preset) => {
              const r = preset.range();
              const selected =
                !anchor && draft.from === r.from && draft.to === r.to;
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => commit(preset.range())}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : "border-border bg-background text-foreground hover:bg-accent"
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Month grid */}
          <div className="space-y-2 p-3">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setViewYear((y) => y - 1)}
                aria-label="Previous year"
              >
                <Icon icon={icons.chevronLeft} size={14} />
              </Button>
              <span className="text-sm font-semibold tabular-nums">
                {viewYear}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setViewYear((y) => y + 1)}
                disabled={viewYear >= nowYear}
                aria-label="Next year"
              >
                <Icon icon={icons.chevronRight} size={14} />
              </Button>
            </div>

            <div
              className="grid grid-cols-3 gap-y-1"
              onMouseLeave={() => setHover(null)}
            >
              {SHORT_MONTHS.map((name, idx) => {
                const key = ym(viewYear, idx + 1);
                const disabled = key > now;
                const inRange = hasShown && key >= lo && key <= hi;
                const isEnd =
                  hasShown && (key === shown.from || key === shown.to);
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={disabled}
                    aria-pressed={inRange}
                    aria-label={monthLabel(key)}
                    onClick={() => pick(key)}
                    onMouseEnter={() => anchor && setHover(key)}
                    onFocus={() => anchor && setHover(key)}
                    className={cn(
                      "h-9 text-xs outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-muted-foreground disabled:line-through",
                      isEnd
                        ? "rounded-md bg-primary font-medium text-primary-foreground"
                        : inRange
                          ? "bg-primary/10 text-foreground"
                          : "rounded-md text-foreground hover:bg-accent",
                      key === now &&
                        !isEnd &&
                        "ring-1 ring-inset ring-primary/40"
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {summary}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => commit(EMPTY)}
              >
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!draft.from}
                onClick={() => commit(draft)}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {isActive && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute end-1 size-7 rounded-full text-muted-foreground"
          aria-label="Clear period"
          onClick={() => onChange(EMPTY)}
        >
          <Icon icon={icons.x} size={14} />
        </Button>
      )}
    </div>
  );
}
