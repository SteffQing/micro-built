"use client";

import * as React from "react";
import {
  toYm,
  parseYm,
  periodLabel,
  comparePeriods,
  type Period,
  type Month,
  MONTHS,
  monthNumber,
} from "@microbuilt/shared";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface PeriodRangeValue {
  from: string; // YYYY-MM or ""
  to: string; // YYYY-MM or ""
}

export interface FilterPeriodRangeProps {
  label?: string;
  value?: PeriodRangeValue;
  onChange: (value: PeriodRangeValue) => void;
  placeholder?: string;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function currentPeriod(): Period {
  const now = new Date();
  const lagos = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    timeZone: "Africa/Lagos",
  }).formatToParts(now);
  const year = Number(lagos.find((p) => p.type === "year")!.value);
  const monthIdx = Number(lagos.find((p) => p.type === "month")!.value) - 1;
  return { year, month: MONTHS[monthIdx] as Month };
}

function prevPeriod(p: Period): Period {
  const idx = monthNumber(p.month);
  return idx === 1
    ? { year: p.year - 1, month: "DECEMBER" as Month }
    : { year: p.year, month: MONTHS[idx - 2] as Month };
}

type Preset = { label: string; range: () => PeriodRangeValue };

const presets: Preset[] = [
  {
    label: "This month",
    range: () => {
      const p = currentPeriod();
      const ym = toYm(p);
      return { from: ym, to: ym };
    },
  },
  {
    label: "Last month",
    range: () => {
      const p = currentPeriod();
      const lm: Period = {
        year: monthNumber(p.month) === 1 ? p.year - 1 : p.year,
        month:
          monthNumber(p.month) === 1
            ? ("DECEMBER" as Month)
            : (MONTHS[monthNumber(p.month) - 2] as Month),
      };
      const ym = toYm(lm);
      return { from: ym, to: ym };
    },
  },
  {
    label: "Last 3 months",
    range: () => {
      const p = currentPeriod();
      const to = toYm(p);
      let from = p;
      for (let i = 0; i < 2; i++) from = prevPeriod(from);
      return { from: toYm(from), to };
    },
  },
  {
    label: "Last 6 months",
    range: () => {
      const p = currentPeriod();
      const to = toYm(p);
      let from = p;
      for (let i = 0; i < 5; i++) from = prevPeriod(from);
      return { from: toYm(from), to };
    },
  },
  {
    label: "Year to date",
    range: () => {
      const p = currentPeriod();
      return { from: `${p.year}-01`, to: toYm(p) };
    },
  },
  {
    label: "All time",
    range: () => ({ from: "", to: "" }),
  },
];

/* ------------------------------------------------------------------ */
/*  Month-Year Picker (grid of months, year nav)                        */
/* ------------------------------------------------------------------ */

function MonthYearPicker({
  value,
  onChange,
  label,
}: {
  value: string; // YYYY-MM or ""
  onChange: (ym: string) => void;
  label: "From" | "To";
}) {
  const now = currentPeriod();
  const parsed = value ? parseYm(value) : null;
  const [viewYear, setViewYear] = React.useState(parsed?.year ?? now.year);

  const shortMonths = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
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
        <span className="text-sm font-semibold tabular-nums">{viewYear}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setViewYear((y) => y + 1)}
          disabled={viewYear >= now.year}
          aria-label="Next year"
        >
          <Icon icon={icons.chevronRight} size={14} />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {shortMonths.map((m, idx) => {
          const ym = `${viewYear}-${String(idx + 1).padStart(2, "0")}`;
          const isFuture = comparePeriods(parseYm(ym), now) > 0;
          const isSelected = value === ym;
          return (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={isSelected ? "default" : "ghost"}
              className="h-8 text-xs"
              disabled={isFuture}
              onClick={() => onChange(ym)}
            >
              {m}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FilterPeriodRange                                                   */
/* ------------------------------------------------------------------ */

export const FilterPeriodRange = React.forwardRef<
  HTMLDivElement,
  FilterPeriodRangeProps
>(({ label, value, onChange, placeholder, className }, ref) => {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<PeriodRangeValue>(value ?? { from: "", to: "" });

  React.useEffect(() => {
    if (open) setDraft(value ?? { from: "", to: "" });
  }, [open, value]);

  const displayLabel = React.useMemo(() => {
    const v = value ?? { from: "", to: "" };
    if (!v.from && !v.to) return placeholder || "All time";
    if (v.from && v.to && v.from === v.to)
      return periodLabel(parseYm(v.from));
    const fromLabel = v.from ? periodLabel(parseYm(v.from)) : "Start";
    const toLabel = v.to ? periodLabel(parseYm(v.to)) : "Now";
    return `${fromLabel} – ${toLabel}`;
  }, [value, placeholder]);

  const isActive = !!(value?.from || value?.to);

  const apply = () => {
    onChange(draft);
    setOpen(false);
  };

  const clear = () => {
    setDraft({ from: "", to: "" });
    onChange({ from: "", to: "" });
    setOpen(false);
  };

  return (
    <div ref={ref} className={cn("flex flex-col gap-2", className)}>
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 w-full justify-start gap-2 rounded-md border-border bg-muted px-3 text-xs font-normal",
              !isActive && "text-muted-foreground"
            )}
          >
            <Icon
              icon={icons.calendar}
              size={16}
              className="shrink-0 text-muted-foreground"
            />
            {displayLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <div className="flex max-sm:flex-col">
            {/* Presets sidebar */}
            <div className="flex flex-col gap-0.5 border-b p-2 sm:w-36 sm:border-b-0 sm:border-e">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start font-normal"
                  onClick={() => {
                    setDraft(preset.range());
                    onChange(preset.range());
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {/* From/To pickers */}
            <div className="grid gap-4 p-3 sm:grid-cols-2">
              <MonthYearPicker
                value={draft.from}
                onChange={(ym) =>
                  setDraft((d) => {
                    const next = { ...d, from: ym };
                    if (next.to && ym > next.to) next.to = "";
                    return next;
                  })
                }
                label="From"
              />
              <MonthYearPicker
                value={draft.to}
                onChange={(ym) =>
                  setDraft((d) => {
                    const next = { ...d, to: ym };
                    if (next.from && ym < next.from) next.from = "";
                    return next;
                  })
                }
                label="To"
              />
            </div>
          </div>
          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
            {isActive && (
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear
              </Button>
            )}
            <Button size="sm" onClick={apply} className="btn-gradient">
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

FilterPeriodRange.displayName = "FilterPeriodRange";
