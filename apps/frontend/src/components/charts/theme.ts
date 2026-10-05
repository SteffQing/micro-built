import type { CSSProperties } from "react";

/** Chart theme built from the app's CSS tokens, so light and dark follow the page automatically. */
export const chartTheme = {
  foreground: "var(--foreground)",
  muted: "var(--muted-foreground)",
  grid: "var(--border)",
  background: "transparent",
  palette: ["var(--chart-2)", "var(--chart-1)", "var(--success)", "var(--warning)", "var(--destructive)", "var(--chart-5)"],
} as const;

/** Tooltip chrome (read by @tanstack/charts from the chart host) mapped onto the card tokens. */
export const chartHostStyle: CSSProperties & Record<`--ts-chart-${string}`, string> = {
  color: "var(--muted-foreground)",
  "--ts-chart-tooltip-background": "var(--popover, var(--card))",
  "--ts-chart-tooltip-color": "var(--foreground)",
  "--ts-chart-tooltip-border": "1px solid var(--border)",
  "--ts-chart-tooltip-border-radius": "0.5rem",
  "--ts-chart-tooltip-shadow": "0 4px 14px rgb(0 0 0 / 0.12)",
  // The library's default highlighted row adds a tinted fill plus a 2px ring that spills over the row above;
  // weight alone marks it (e.g. the "Total" line) cleanly.
  "--ts-chart-tooltip-active-row-background": "transparent",
  "--ts-chart-tooltip-active-row-shadow": "none",
  "--ts-chart-tooltip-active-row-font-weight": "600",
};

const compact = new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 });

/** Short naira label for axes, e.g. ₦1.2M. */
export const formatCompactNaira = (value: number) => `₦${compact.format(value)}`;

export const formatPercent = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;
