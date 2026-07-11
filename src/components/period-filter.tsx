"use client";

// ponytail: native <input type="date"> — no picker dependency. Empty `from`/`to`
// means all-time. Outstanding is a live snapshot and ignores this range (see API).
type Props = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
};

export default function PeriodFilter({ from, to, onChange }: Props) {
  return (
    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm text-[#999] sm:flex sm:w-auto sm:flex-wrap">
      <span className="col-span-3 text-xs sm:col-span-1">Date:</span>
      <input
        type="date"
        value={from}
        max={to || undefined}
        onChange={(e) => onChange(e.target.value, to)}
        className="h-10 min-w-0 w-full rounded-md border bg-[#fafafa] px-2 text-xs sm:h-9 sm:w-auto"
        aria-label="From date"
      />
      <span className="text-muted-foreground">to</span>
      <input
        type="date"
        value={to}
        min={from || undefined}
        onChange={(e) => onChange(from, e.target.value)}
        className="h-10 min-w-0 w-full rounded-md border bg-[#fafafa] px-2 text-xs sm:h-9 sm:w-auto"
        aria-label="To date"
      />
      {(from || to) && (
        <button
          type="button"
          onClick={() => onChange("", "")}
          className="col-span-3 justify-self-start text-xs text-muted-foreground underline underline-offset-2 sm:col-span-1"
        >
          clear
        </button>
      )}
    </div>
  );
}
