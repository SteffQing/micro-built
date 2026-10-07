import { formatPeriodLabel } from "@/lib/utils";

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});

const day = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

/** "7 Oct 2026, 14:05" in Lagos time. */
export function whenLabel(iso: string): string {
  return when.format(new Date(iso));
}

/** "7 Oct 2026" in Lagos time. */
export function dayLabel(iso: string): string {
  return day.format(new Date(iso));
}

/** The API's "OCTOBER 2026" as "October 2026". */
export const monthName = formatPeriodLabel;
