"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

export interface RangeValue {
  min?: number;
  max?: number;
}

export interface FilterRangeProps {
  label?: string;
  value?: RangeValue;
  onChange: (value: RangeValue) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: "currency" | "percentage" | "number";
  className?: string;
}

export const FilterRange = React.forwardRef<HTMLDivElement, FilterRangeProps>(
  (
    {
      label,
      value,
      onChange,
      min = 0,
      max = 100,
      step = 1,
      format = "number",
      className,
    },
    ref
  ) => {
    const [localMin, setLocalMin] = React.useState<string>(
      value?.min?.toString() || min.toString()
    );
    const [localMax, setLocalMax] = React.useState<string>(
      value?.max?.toString() || max.toString()
    );

    const formatValue = (val: number) => {
      switch (format) {
        case "currency":
          return formatCurrency(val);
        case "percentage":
          return `${val}%`;
        default:
          return val.toLocaleString();
      }
    };

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalMin(newValue);

      const numValue = parseFloat(newValue);
      if (!isNaN(numValue)) {
        onChange({
          min: Math.max(min, Math.min(numValue, value?.max || max)),
          max: value?.max,
        });
      }
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalMax(newValue);

      const numValue = parseFloat(newValue);
      if (!isNaN(numValue)) {
        onChange({
          min: value?.min,
          max: Math.min(max, Math.max(numValue, value?.min || min)),
        });
      }
    };

    const handleMinSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const numValue = parseFloat(e.target.value);
      setLocalMin(numValue.toString());
      onChange({
        min: numValue,
        max: value?.max,
      });
    };

    const handleMaxSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const numValue = parseFloat(e.target.value);
      setLocalMax(numValue.toString());
      onChange({
        min: value?.min,
        max: numValue,
      });
    };

    React.useEffect(() => {
      if (value?.min !== undefined) {
        setLocalMin(value.min.toString());
      }
      if (value?.max !== undefined) {
        setLocalMax(value.max.toString());
      }
    }, [value]);

    const currentMin = value?.min ?? min;
    const currentMax = value?.max ?? max;

    return (
      <div ref={ref} className={cn("flex flex-col gap-3", className)}>
        {label && <Label className="text-sm font-medium">{label}</Label>}

        <div className="space-y-4">
          {/* Dual Slider */}
          <div className="relative pt-6 pb-2">
            <div className="relative h-2">
              {/* Track */}
              <div className="absolute w-full h-2 bg-muted rounded-full" />

              {/* Active Range */}
              <div
                className="absolute h-2 bg-primary rounded-full"
                style={{
                  left: `${((currentMin - min) / (max - min)) * 100}%`,
                  right: `${100 - ((currentMax - min) / (max - min)) * 100}%`,
                }}
              />

              {/* Min Slider */}
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={currentMin}
                onChange={handleMinSliderChange}
                className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
              />

              {/* Max Slider */}
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={currentMax}
                onChange={handleMaxSliderChange}
                className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
              />
            </div>
          </div>

          {/* Min/Max Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Minimum</Label>
              <Input
                type="number"
                min={min}
                max={currentMax}
                step={step}
                value={localMin}
                onChange={handleMinChange}
                className="h-10"
              />
              <div className="text-xs text-muted-foreground">
                {formatValue(currentMin)}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Maximum</Label>
              <Input
                type="number"
                min={currentMin}
                max={max}
                step={step}
                value={localMax}
                onChange={handleMaxChange}
                className="h-10"
              />
              <div className="text-xs text-muted-foreground">
                {formatValue(currentMax)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

FilterRange.displayName = "FilterRange";
