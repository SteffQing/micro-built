import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useFormContext, Path, Controller } from "react-hook-form";
import type { OnboardCustomerType } from "../schema";
import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Check, X } from "lucide-react";
import {
  getNested,
  isValidDate,
  formatYYYYMMDD,
  parseYYYYMMDD,
  startOfDay,
  endOfDay,
  formatDisplay,
} from "./utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface InputBoxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: Path<OnboardCustomerType>;
}

function InputBox({ label, name, ...rest }: InputBoxProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<OnboardCustomerType>();

  const fieldError = name
    .split(".")
    .reduce((acc: any, key) => acc?.[key], errors);

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name} className="text-sm font-normal text-[#333333]">
        {label}
      </Label>

      <Input
        id={name}
        {...register(name)}
        {...rest}
        className={cn(
          "border bg-[#FAFAFA] rounded-[8px] px-3 py-2 outline-none placeholder:text-[#999999] placeholder:text-xs font-normal",
          fieldError
            ? "border-red-500 focus:border-red-500"
            : "border-[#F0F0F0] focus:border-[#F0F0F0]"
        )}
      />

      {fieldError?.message && (
        <p className="text-sm text-red-500">{String(fieldError.message)}</p>
      )}
    </div>
  );
}

interface Option {
  label: string;
  value: string;
}

interface SelectBoxProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  name: Path<OnboardCustomerType>;
  options: Option[];
  placeholder?: string;
}

function SelectBox({
  label,
  name,
  options,
  placeholder,
  ...rest
}: SelectBoxProps) {
  const {
    formState: { errors },
    control,
  } = useFormContext<OnboardCustomerType>();
  const [open, setOpen] = React.useState(false);

  const fieldError = name
    .split(".")
    .reduce((acc: any, key) => acc?.[key], errors);

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name} className="text-sm font-normal text-[#333333]">
        {label}
      </Label>

      <Controller
        control={control}
        name={name as any}
        render={({ field }) => {
          const selected = options.find((o) => o.value === field.value);

          return (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={name}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  aria-invalid={!!fieldError}
                  className={cn(
                    "w-full justify-start rounded-[8px] bg-[#FAFAFA] px-3 py-2 h-11 text-sm font-normal",
                    fieldError
                      ? "border-red-500 focus-visible:ring-red-500"
                      : "border-[#F0F0F0] focus-visible:ring-[#E0E0E0]"
                  )}
                >
                  <span
                    className={cn(
                      "truncate",
                      !selected && "text-muted-foreground"
                    )}
                  >
                    {selected
                      ? selected.label
                      : placeholder ?? `Select ${label}`}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="p-1 w-(--radix-popover-trigger-width)"
                align="start"
                sideOffset={4}
              >
                <div
                  role="listbox"
                  aria-label={label}
                  aria-activedescendant={selected?.value ?? undefined}
                >
                  <ScrollArea className="max-h-60">
                    <div className="flex flex-col">
                      {options.map((opt) => {
                        const isSelected = field.value === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              field.onChange(opt.value);
                              setOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-sm",
                              isSelected
                                ? "bg-neutral-100 text-neutral-900"
                                : "hover:bg-neutral-50 text-neutral-700"
                            )}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="truncate">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
          );
        }}
      />

      {fieldError?.message && (
        <p className="text-sm text-red-500">{String(fieldError.message)}</p>
      )}
    </div>
  );
}

type FormDatePickerProps = {
  label: string;
  name: string;
  placeholder?: string;
  className?: string;
};

function DatePicker({
  label,
  name,
  placeholder,
  className,
}: FormDatePickerProps) {
  const { control, formState } = useFormContext();
  const fieldError = getNested(formState.errors, name) as
    | { message?: string }
    | undefined;
  const errorId = `${name}-error`;

  const [open, setOpen] = React.useState(false);

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18);
  const disabledMatchers: any[] = [];
  if (maxDate) disabledMatchers.push({ after: endOfDay(maxDate) });

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label htmlFor={name} className="text-sm font-normal text-[#333333]">
        {label}
      </Label>

      <Controller
        control={control}
        name={name as any}
        render={({ field }) => {
          let selectedDate: Date | undefined = undefined;
          if (field.value instanceof Date) {
            selectedDate = field.value;
          } else if (typeof field.value === "string") {
            selectedDate =
              parseYYYYMMDD(field.value) ??
              (isValidDate(new Date(field.value))
                ? new Date(field.value)
                : undefined);
          }

          function writeValue(date?: Date) {
            if (!date) {
              field.onChange(""); // empty value
              return;
            }
            field.onChange(formatYYYYMMDD(date));
          }

          return (
            <div className="relative">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id={name}
                    type="button"
                    variant="outline"
                    aria-invalid={!!fieldError}
                    aria-haspopup="dialog"
                    className={cn(
                      "w-full justify-between rounded-[8px] bg-[#FAFAFA] px-3 py-2 h-11 text-sm font-normal",
                      fieldError
                        ? "border-red-500 focus-visible:ring-red-500"
                        : "border-[#F0F0F0] focus-visible:ring-[#E0E0E0]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center gap-2 truncate",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 text-[#666666]" />
                      {selectedDate
                        ? formatDisplay(selectedDate)
                        : placeholder ?? `Select ${label}`}
                    </span>

                    {selectedDate ? (
                      <span className="ml-2 inline-flex items-center">
                        <X
                          aria-label="Clear date"
                          className="h-4 w-4 text-[#888888] hover:text-[#555555]"
                          onClick={(e) => {
                            e.stopPropagation();
                            writeValue(undefined);
                          }}
                        />
                      </span>
                    ) : null}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-(--radix-popover-trigger-width)">
                  <div className="p-2">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => {
                        if (d) {
                          writeValue(d);
                          setOpen(false);
                        }
                      }}
                      disabled={
                        disabledMatchers.length ? disabledMatchers : undefined
                      }
                      captionLayout="dropdown"
                    />
                    <div className="flex items-center justify-between px-1 pb-1 pt-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => writeValue(undefined)}
                        >
                          Clear
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="h-8 px-3"
                          onClick={() => setOpen(false)}
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {fieldError?.message && (
                <p id={errorId} className="mt-1 text-sm text-red-500">
                  {String(fieldError.message)}
                </p>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}

export { InputBox, SelectBox, DatePicker };
