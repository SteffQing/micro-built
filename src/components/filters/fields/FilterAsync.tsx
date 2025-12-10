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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2Icon, SearchIcon } from "lucide-react";

export interface AsyncOption {
  label: string;
  value: string;
}

export interface FilterAsyncProps {
  label?: string;
  value?: string;
  onChange: (value: string) => void;
  fetchOptions: (searchQuery?: string) => Promise<AsyncOption[]>;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
}

export const FilterAsync = React.forwardRef<
  HTMLButtonElement,
  FilterAsyncProps
>(
  (
    {
      label,
      value,
      onChange,
      fetchOptions,
      placeholder,
      className,
      searchable = true,
    },
    ref
  ) => {
    const [options, setOptions] = React.useState<AsyncOption[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [open, setOpen] = React.useState(false);

    const loadOptions = React.useCallback(
      async (query?: string) => {
        setLoading(true);
        setError(null);
        try {
          const data = await fetchOptions(query);
          setOptions(data);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Failed to load options"
          );
          setOptions([]);
        } finally {
          setLoading(false);
        }
      },
      [fetchOptions]
    );

    // Load options when dropdown opens
    React.useEffect(() => {
      if (open) {
        loadOptions(searchQuery);
      }
    }, [open, loadOptions, searchQuery]);

    const filteredOptions = React.useMemo(() => {
      if (!searchable || !searchQuery) return options;

      const query = searchQuery.toLowerCase();
      return options.filter(
        (option) =>
          option.label.toLowerCase().includes(query) ||
          option.value.toLowerCase().includes(query)
      );
    }, [options, searchQuery, searchable]);

    const selectedOption = options.find((opt) => opt.value === value);

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {label && <Label className="text-sm font-medium">{label}</Label>}

        <Select
          value={value || undefined}
          onValueChange={onChange}
          open={open}
          onOpenChange={setOpen}
        >
          <SelectTrigger ref={ref} className="w-full">
            <SelectValue placeholder={placeholder || "Select an option"}>
              {selectedOption?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {searchable && (
              <div className="p-2 border-b sticky top-0 bg-popover z-10">
                <div className="relative">
                  <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading...
                </span>
              </div>
            )}

            {error && (
              <div className="p-4 text-sm text-destructive text-center">
                {error}
              </div>
            )}

            {!loading && !error && filteredOptions.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No options found
              </div>
            )}

            {!loading &&
              !error &&
              filteredOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
);

FilterAsync.displayName = "FilterAsync";
