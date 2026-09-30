import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useDebounce } from "@/hooks/use-debounce";

export type FilterValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined
  | {
      start?: Date;
      end?: Date;
    }
  | {
      min?: number;
      max?: number;
    }
  | {
      month?: number;
      year?: number;
    };

export type FilterState = Record<string, FilterValue>;

export interface UseFiltersOptions {
  initialState?: FilterState;
  debounceMs?: number;
  onFilterChange?: (filters: FilterState) => void;
}

export const useFilters = (options: UseFiltersOptions = {}) => {
  const { initialState = {}, debounceMs = 500, onFilterChange } = options;

  const [filters, setFilters] = useState<FilterState>(initialState);

  const debouncedFilters = useDebounce(filters, debounceMs);

  const onFilterChangeRef = useRef(onFilterChange);
  useEffect(() => {
    onFilterChangeRef.current = onFilterChange;
  });

  useEffect(() => {
    onFilterChangeRef.current?.(debouncedFilters);
  }, [debouncedFilters]);

  const setFilter = useCallback((key: string, value: FilterValue) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialState);
  }, [initialState]);

  const isFiltered = useMemo(() => {
    return Object.values(filters).some((value) => {
      if (value === null || value === undefined || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (typeof value === "object") {
        if ("start" in value || "end" in value) {
          return value.start !== undefined || value.end !== undefined;
        }
        if ("min" in value || "max" in value) {
          return value.min !== undefined || value.max !== undefined;
        }
        if ("month" in value || "year" in value) {
          return value.month !== undefined || value.year !== undefined;
        }
      }
      return true;
    });
  }, [filters]);

  const queryDto = useMemo(() => {
    const dto: Record<string, string | number | boolean> = {};

    Object.keys(debouncedFilters).forEach((key) => {
      const value = debouncedFilters[key];

      if (
        value === null ||
        value === undefined ||
        value === "" ||
        value === "undefined"
      )
        return;

      if (Array.isArray(value)) {
        if (value.length > 0) {
          dto[key] = value.join(",");
        }
        return;
      }

      if (
        typeof value === "object" &&
        value !== null &&
        ("start" in value || "end" in value)
      ) {
        const dateRange = value as { start?: Date; end?: Date };
        if (dateRange.start) {
          dto[`${key}Start`] = dateRange.start.toISOString();
        }
        if (dateRange.end) {
          dto[`${key}End`] = dateRange.end.toISOString();
        }
        return;
      }

      if (
        typeof value === "object" &&
        value !== null &&
        ("min" in value || "max" in value)
      ) {
        const range = value as { min?: number; max?: number };
        if (range.min !== undefined) {
          dto[`${key}Min`] = range.min;
        }
        if (range.max !== undefined) {
          dto[`${key}Max`] = range.max;
        }
        return;
      }

      if (
        typeof value === "object" &&
        value !== null &&
        ("month" in value || "year" in value)
      ) {
        const monthYear = value as { month?: number; year?: number };
        if (monthYear.month !== undefined && monthYear.year !== undefined) {
          const months = [
            "JANUARY",
            "FEBRUARY",
            "MARCH",
            "APRIL",
            "MAY",
            "JUNE",
            "JULY",
            "AUGUST",
            "SEPTEMBER",
            "OCTOBER",
            "NOVEMBER",
            "DECEMBER",
          ];
          dto[key] = `${months[monthYear.month]} ${monthYear.year}`;
        } else if (monthYear.year !== undefined) {
          dto[`${key}Year`] = monthYear.year;
        } else if (monthYear.month !== undefined) {
          dto[`${key}Month`] = monthYear.month + 1;
        }
        return;
      }

      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        dto[key] = value;
      }
    });

    return dto;
  }, [debouncedFilters]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    Object.entries(queryDto).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params.append(key, String(value));
      }
    });

    const result = params.toString();
    return result ? `?${result}` : "";
  }, [queryDto]);

  return {
    filters,
    debouncedFilters,
    setFilter,
    clearFilters,
    isFiltered,
    qDto: queryDto,
    qString: queryString,
  };
};
