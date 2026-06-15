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
    <div className="flex items-center gap-2 mb-3 text-sm">
      <input
        type="date"
        value={from}
        max={to || undefined}
        onChange={(e) => onChange(e.target.value, to)}
        className="border rounded-md px-2 py-1"
        aria-label="From date"
      />
      <span className="text-muted-foreground">to</span>
      <input
        type="date"
        value={to}
        min={from || undefined}
        onChange={(e) => onChange(from, e.target.value)}
        className="border rounded-md px-2 py-1"
        aria-label="To date"
      />
      {(from || to) && (
        <button
          type="button"
          onClick={() => onChange("", "")}
          className="text-muted-foreground underline underline-offset-2"
        >
          clear
        </button>
      )}
    </div>
  );
}
