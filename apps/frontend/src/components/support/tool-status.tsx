"use client";

import { Icon, icons } from "@/components/icon";
import { cn } from "@/lib/utils";

// What the assistant is doing while it looks something up. Only the tool's name reaches the browser: never its
// input or output.
export const TOOL_LABELS: Record<string, string> = {
  my_overview: "Checking your account…",
  my_loan: "Checking your loan…",
  my_deductions: "Looking at your deductions…",
  my_repayments: "Looking at your repayments…",
  my_liquidations: "Checking your early payments…",
  my_asset_requests: "Checking your asset requests…",
  my_change_requests: "Checking your requests…",
  my_notifications: "Checking your notifications…",
  my_payment_method: "Checking your bank details…",
  find_my_customers: "Finding the customer…",
  find_customers: "Finding the customer…",
  customer_summary: "Looking at the customer…",
  customer_deductions: "Looking at their deductions…",
  my_portfolio: "Looking at your portfolio…",
  my_topups: "Checking top-ups…",
  loan_details: "Looking at the loan…",
  org_variation_status: "Checking the variation…",
};

/** Short labels for staff ("looked at: loan, deductions"). */
export const TOOL_TOPICS: Record<string, string> = {
  my_overview: "dashboard",
  my_loan: "loan",
  my_deductions: "deductions",
  my_repayments: "repayments",
  my_liquidations: "early payments",
  my_asset_requests: "asset requests",
  my_change_requests: "change requests",
  my_notifications: "notifications",
  my_payment_method: "bank details",
  find_my_customers: "customer search",
  find_customers: "customer search",
  customer_summary: "customer",
  customer_deductions: "deductions",
  my_portfolio: "portfolio",
  my_topups: "top-ups",
  loan_details: "loan",
  org_variation_status: "variation",
};

export function ToolStatus({ name, done }: { name: string; done: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground",
        !done && "motion-safe:animate-pulse"
      )}
    >
      <Icon icon={done ? icons.check : icons.search} size={12} />
      {TOOL_LABELS[name] ?? "Looking that up…"}
    </span>
  );
}
