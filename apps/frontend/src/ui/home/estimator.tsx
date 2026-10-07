"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getConfig } from "@/lib/queries/config";
import { cn, formatCurrency } from "@/lib/utils";

const MIN = 50_000;
const MAX = 2_000_000;
const STEP = 10_000;
const TENURES = [3, 6, 9, 12, 18, 24];

/*
 * A repayment estimate at today's rates (GET /config is public). Same arithmetic as disbursement: interest is
 * amount × monthly rate × months, spread evenly over the monthly deductions; the management fee is taken once from
 * the cash paid out, never added to what's owed.
 */
export function RepaymentEstimator() {
  const amountId = useId();
  const [amount, setAmount] = useState(300_000);
  const [months, setMonths] = useState(12);
  const { data, isLoading } = useQuery(getConfig);

  const interestRate = data?.data?.interestRate ?? null;
  const feeRate = data?.data?.managementFeeRate ?? null;
  const ready = interestRate !== null && feeRate !== null;

  const interest = ready ? amount * (interestRate / 100) * months : 0;
  const fee = ready ? amount * (feeRate / 100) : 0;
  const monthly = (amount + interest) / months;
  const show = (value: number) => (ready ? formatCurrency(Math.round(value)) : "—");

  return (
    <div className="grid overflow-hidden rounded-3xl border bg-background shadow-xl lg:grid-cols-[1.15fr_1fr]">
      <div className="p-6 sm:p-8">
        <div className="flex items-end justify-between gap-4">
          <label htmlFor={amountId} className="text-sm font-medium text-muted-foreground">
            I&apos;d like to borrow
          </label>
          <output htmlFor={amountId} className="text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
            {formatCurrency(amount)}
          </output>
        </div>
        <input
          id={amountId}
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="mt-5 h-2 w-full cursor-pointer accent-[var(--brand)]"
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(MIN)}</span>
          <span>{formatCurrency(MAX)}</span>
        </div>

        <fieldset className="mt-8">
          <legend className="text-sm font-medium text-muted-foreground">Repay over</legend>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {TENURES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={months === option}
                onClick={() => setMonths(option)}
                className={cn(
                  "rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  months === option
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted",
                )}
              >
                {option} mo
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-col justify-between gap-6 border-t bg-muted/50 p-6 sm:p-8 lg:border-l lg:border-t-0">
        <div>
          <p className="text-sm text-muted-foreground">Your monthly deduction</p>
          <p
            className={cn(
              "mt-1 text-4xl font-semibold tabular-nums tracking-tight text-primary sm:text-5xl",
              isLoading && "animate-pulse",
            )}
          >
            {show(monthly)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">for {months} months, straight from your salary</p>
        </div>

        <dl className="grid gap-2.5 text-sm">
          <Row label="Paid to your bank" value={show(amount - fee)} />
          <Row label={`Interest (${ready ? `${interestRate}% a month` : "monthly"})`} value={show(interest)} />
          <Row label={`Management fee (${ready ? `${feeRate}%, ` : ""}one-time)`} value={show(fee)} />
          <div className="border-t pt-2.5">
            <Row label="Total you repay" value={show(amount + interest)} strong />
          </div>
        </dl>

        <p className="text-xs leading-5 text-muted-foreground">
          {ready || isLoading
            ? "An estimate at today's rates. Your tenure and final figures are confirmed when your loan is approved, and you see every rate before you confirm a request."
            : "Rates are being updated. You'll see every rate before you confirm a request."}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "font-semibold" : "font-medium")}>{value}</dd>
    </div>
  );
}
