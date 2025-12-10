"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface MonthYearValue {
  month?: number; // 0-11 (January = 0)
  year?: number;
}

export interface FilterMonthYearProps {
  label?: string;
  value?: MonthYearValue;
  onChange: (value: MonthYearValue) => void;
  placeholder?: string;
  className?: string;
  minYear?: number;
  maxYear?: number;
}

const MONTHS = [
  { label: "January", value: 0 },
  { label: "February", value: 1 },
  { label: "March", value: 2 },
  { label: "April", value: 3 },
  { label: "May", value: 4 },
  { label: "June", value: 5 },
  { label: "July", value: 6 },
  { label: "August", value: 7 },
  { label: "September", value: 8 },
  { label: "October", value: 9 },
  { label: "November", value: 10 },
  { label: "December", value: 11 },
];

export const FilterMonthYear = React.forwardRef<
  HTMLDivElement,
  FilterMonthYearProps
>(
  (
    { label, value, onChange, placeholder, className, minYear = 2024, maxYear },
    ref
  ) => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Default maxYear to current year if not provided
    const effectiveMaxYear = maxYear || currentYear;

    // Generate years array from minYear to maxYear
    const years = React.useMemo(() => {
      const yearsArray = [];
      for (let year = minYear; year <= effectiveMaxYear; year++) {
        yearsArray.push(year);
      }
      return yearsArray;
    }, [minYear, effectiveMaxYear]);

    // Filter months based on selected year
    const availableMonths = React.useMemo(() => {
      if (!value?.year) return MONTHS;

      // If selected year is current year, only show months up to current month
      if (value.year === currentYear) {
        return MONTHS.filter((month) => month.value <= currentMonth);
      }

      // If selected year is in the future (shouldn't happen with maxYear), show all months
      // If selected year is in the past, show all months
      return MONTHS;
    }, [value?.year, currentYear, currentMonth]);

    const handleMonthChange = (monthStr: string) => {
      const month = parseInt(monthStr, 10);
      onChange({
        month,
        year: value?.year,
      });
    };

    const handleYearChange = (yearStr: string) => {
      const year = parseInt(yearStr, 10);
      const newValue: MonthYearValue = {
        month: value?.month,
        year,
      };

      // If the selected month is not available in the new year, reset it
      if (
        year === currentYear &&
        value?.month !== undefined &&
        value.month > currentMonth
      ) {
        newValue.month = undefined;
      }

      onChange(newValue);
    };

    const formatValue = () => {
      if (value?.month !== undefined && value?.year) {
        const monthName = MONTHS[value.month].label;
        return `${monthName} ${value.year}`;
      }
      if (value?.year) {
        return `${value.year}`;
      }
      if (value?.month !== undefined) {
        return MONTHS[value.month].label;
      }
      return placeholder || "Select month and year";
    };

    return (
      <div ref={ref} className={cn("flex flex-col gap-2", className)}>
        {label && <Label className="text-sm font-medium">{label}</Label>}

        <div className="grid grid-cols-2 gap-2">
          {/* Month Select */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Month</Label>
            <Select
              value={value?.month?.toString()}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Year Select */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Year</Label>
            <Select
              value={value?.year?.toString()}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Display Selected Value */}
        {(value?.month !== undefined || value?.year) && (
          <div className="text-xs text-muted-foreground">
            Selected:{" "}
            <span className="font-medium text-foreground">{formatValue()}</span>
          </div>
        )}
      </div>
    );
  }
);

FilterMonthYear.displayName = "FilterMonthYear";
