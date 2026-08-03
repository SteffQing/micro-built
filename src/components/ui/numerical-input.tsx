"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

const NUMBER_RE = /^[0-9]*[.,]?[0-9]*$/;

type NumericalInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "defaultValue" | "onChange" | "inputMode"
> & {
  value: number;
  onValueChange: (value: number) => void;
  maxDecimals?: number;
  /** Show an empty field instead of a seeded zero while keeping numeric form state. */
  emptyOnZero?: boolean;
};

function getDisplayValue(value: number, emptyOnZero: boolean) {
  if (!Number.isFinite(value) || (emptyOnZero && value === 0)) return "";
  return String(value);
}

/**
 * A locale-friendly numerical input with a genuine empty editing state.
 * It deliberately uses text entry because native number inputs discard useful
 * intermediate values such as `1.` and also permit unwanted exponent syntax.
 */
function NumericalInput({
  value,
  onValueChange,
  maxDecimals,
  emptyOnZero = false,
  onBlur,
  className,
  ...props
}: NumericalInputProps) {
  const [displayValue, setDisplayValue] = React.useState(() =>
    getDisplayValue(value, emptyOnZero),
  );
  const lastEmittedValue = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (
      lastEmittedValue.current !== null &&
      Object.is(lastEmittedValue.current, value)
    ) {
      lastEmittedValue.current = null;
      return;
    }

    setDisplayValue(getDisplayValue(value, emptyOnZero));
  }, [value, emptyOnZero]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      autoCorrect="off"
      pattern="^[0-9]*[.,]?[0-9]*$"
      spellCheck={false}
      value={displayValue}
      className={className}
      onChange={(event) => {
        const normalized = normalizeNumericalInput(
          event.currentTarget.value,
          maxDecimals,
        );
        if (normalized === null) return;

        setDisplayValue(normalized);
        const nextValue = normalized === "" ? 0 : Number(normalized);
        if (!Number.isFinite(nextValue)) return;

        lastEmittedValue.current = nextValue;
        onValueChange(nextValue);
      }}
      onBlur={(event) => {
        setDisplayValue(getDisplayValue(value, emptyOnZero));
        onBlur?.(event);
      }}
    />
  );
}

function normalizeNumericalInput(
  value: string,
  maxDecimals?: number,
): string | null {
  const normalized = value.replace(/,/g, ".");
  if (!NUMBER_RE.test(normalized)) return null;

  const [whole = "", fractional] = normalized.split(".");
  if (
    maxDecimals !== undefined &&
    fractional !== undefined &&
    (maxDecimals === 0 || fractional.length > maxDecimals)
  ) {
    return null;
  }

  const compactWhole = whole.replace(/^0+(?=\d)/, "") || (whole ? "0" : "");
  return fractional === undefined
    ? compactWhole
    : `${compactWhole || "0"}.${fractional}`;
}

export { NumericalInput, normalizeNumericalInput };
export type { NumericalInputProps };
