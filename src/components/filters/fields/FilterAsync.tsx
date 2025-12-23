"use client";

import { Check, ChevronsUpDown, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";

export type AsyncQueryOptions<TItem> = UseQueryOptions<
  ApiRes<TItem[]>,
  Error,
  ApiRes<TItem[]>
>;

export interface FilterAsyncProps<TItem> {
  label?: string;
  value?: string;
  query: AsyncQueryOptions<TItem>;
  onChange: (value: string) => void;
  labelKey?: string;
  valueKey?: string;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
}

export function FilterAsync<TData extends object>({
  label,
  value,
  onChange,
  query,
  labelKey = "name",
  valueKey = "id",
  placeholder,
  className,
  searchable = true,
}: FilterAsyncProps<TData>) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useQuery(query);

  const options = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;

    return [];
  }, [data]);

  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt[valueKey]) === String(value));
  }, [options, value, valueKey]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value && selectedOption ? (
              selectedOption[labelKey]
            ) : (
              <span className="text-muted-foreground">
                {placeholder || "Select option"}
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="min-w-[200px] w-full p-0">
          <Command>
            {searchable && <CommandInput placeholder="Search..." />}
            <CommandList>
              {isLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!isLoading && isError && (
                <div className="py-6 text-center text-sm text-destructive">
                  Failed to load
                </div>
              )}

              {!isLoading && !isError && options.length === 0 && (
                <CommandEmpty>No results found.</CommandEmpty>
              )}

              <CommandGroup>
                {!isLoading &&
                  options.map((option) => (
                    <CommandItem
                      key={String(option[valueKey])}
                      value={String(option[labelKey])} // Search by label
                      onSelect={() => {
                        onChange(String(option[valueKey]));
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === String(option[valueKey])
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {option[labelKey]}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
