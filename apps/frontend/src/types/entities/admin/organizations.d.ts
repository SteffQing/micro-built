/** "2026-10" and "OCTOBER 2026". */
type PayrollMonthRef = { ym: string; label: string };

/** GET /admin/organizations: an employer whose payroll deducts repayments, and where its variations stand. */
type OrganizationDto = {
  id: string;
  name: string;
  customers: number;
  runningLoans: number;
  /** The latest month whose variation is locked (a voucher, or no payroll). */
  latestLocked: PayrollMonthRef | null;
  /** Variations generated but not locked yet, in month order. */
  unlocked: {
    variationId: string;
    ym: string;
    label: string;
    version: number;
    updatedAt: string;
    /** Generated before the previous month last locked or was reverted: regenerate it. */
    regenerateHint: boolean;
  }[];
  /** Whether any of its customers has a deduction this month (otherwise this month is skipped). */
  deductionsThisMonth: boolean;
};

type OrganizationSwitchOutcome = "CREATED" | "NOT_FOUND" | "ALREADY_IN_ORGANIZATION" | "PENDING_EXISTS";

/** POST /admin/organizations/:id/switch-requests */
type OrganizationSwitchResultDto = {
  results: { externalId: string; outcome: OrganizationSwitchOutcome; requestId?: string }[];
};
