import { api } from "@/lib/axios";

// Variations per organization (PLAN_V2 §2): one organization's variation for a month, generated as often as needed
// (each version replaces the last) until its voucher, or a "no payroll", locks it.

export type VariationAction = "START" | "AMEND" | "STOP";
export type VariationReason =
  | "NEW_LOAN"
  | "TOPUP"
  | "LIQUIDATION"
  | "TENURE_CHANGE"
  | "DEFAULT"
  | "TRANSFER";

export type VariationRow = {
  loanId: string;
  customerId: string;
  externalId: string | null;
  name: string;
  command: string | null;
  balance: number;
  amount: number;
  tenure: number;
  action: VariationAction;
  reasons: VariationReason[];
  /** dd/MM/yyyy */
  start: string;
  /** dd/MM/yyyy */
  end: string;
};

export type OrgRef = { id: string; name: string };
/** "2026-10" and "OCTOBER 2026". */
export type MonthRef = { ym: string; label: string };

export type VariationLock =
  | { kind: "VOUCHER"; voucherId: string; filename: string; uploadedAt: string }
  | { kind: "NO_PAYROLL"; reason: string };

export type VariationState = {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  lock: VariationLock | null;
  /** Generated before the organization's previous month last locked or was reverted: its amounts may be stale. */
  regenerateHint: boolean;
  /** File versions still kept, ascending (older ones go once the variation locks). */
  versions: number[];
};

export type VariationCounts = Record<VariationAction, number>;

export type VariationPreview = {
  organization: OrgRef;
  period: MonthRef;
  variation: VariationState | null;
  /** Filtered by action/reason; once locked, what its current version holds. */
  rows: VariationRow[];
  /** Over every row, before the filter. */
  counts: VariationCounts;
  /** Deductions generating would freeze, unchanged ones included. */
  frozen: number;
  /** The organization has no deductions this month: nothing to generate, no voucher. */
  skipped: boolean;
  /** Why generating is refused right now, or null. */
  generateBlockedBy: string | null;
};

export type VariationHistoryItem = {
  id: string;
  period: MonthRef;
  version: number;
  updatedAt: string;
  lock: VariationLock | null;
};

export type VariationFilters = {
  action?: VariationAction;
  reason?: VariationReason;
};

export type GenerateVariationsResult = {
  period: MonthRef;
  queued: OrgRef[];
  skipped: OrgRef[];
  refused: (OrgRef & { reason: string })[];
};

export type NoPayrollResult = {
  variationId: string;
  label: string;
  failed: number;
  penalties: number;
  penaltyTotal: number;
  proposals: number;
};

export type NoPayrollRevertResult = {
  variationId: string;
  penaltiesRemoved: number;
  proposalsWithdrawn: number;
};

export type RevertVariationResult = {
  variationId: string;
  organization: string;
  period: string;
  ym: string;
  /** The version now current; 0 when version 1 was reverted and the variation is gone. */
  version: number;
  reopened: number;
};

export const variationBase = "/admin/variations";
export const variationPreviewKey = (
  organizationId: string,
  period: string,
  filters: VariationFilters = {},
) => [variationBase, organizationId, period, filters.action ?? null, filters.reason ?? null];
export const variationHistoryKey = (organizationId: string) => [variationBase, "history", organizationId];

export async function getVariationPreview(organizationId: string, period: string, filters: VariationFilters = {}) {
  const response = await api.get<ApiRes<VariationPreview>>(variationBase, {
    params: { organizationId, period, action: filters.action, reason: filters.reason },
  });
  if (!response.data.data) throw new Error("The variation preview could not be loaded");
  return response.data.data;
}

export async function getVariationHistory(organizationId: string) {
  const response = await api.get<ApiRes<VariationHistoryItem[]>>(`${variationBase}/history`, {
    params: { organizationId },
  });
  return response.data.data ?? [];
}

/** SUPER_ADMIN, confirmed with a code or passkey (the axios interceptor asks). One job per queued organization. */
export async function generateVariations(input: { period: string; organizationIds?: string[]; all?: boolean }) {
  const response = await api.post<ApiRes<GenerateVariationsResult>>(`${variationBase}/generate`, input);
  return response.data;
}

export async function getVariationFile(input: { id: string; version?: number }) {
  const response = await api.get<ApiRes<{ url: string; expiresIn: number; filename: string }>>(
    `${variationBase}/${input.id}/file`,
    { params: input.version ? { version: input.version } : undefined },
  );
  if (!response.data.data) throw new Error("The file link could not be created");
  return response.data.data;
}

/** SUPER_ADMIN: the voucher never came; everyone in the variation is marked failed and charged. */
export async function markNoPayroll(input: { id: string; reason: string }) {
  const response = await api.post<ApiRes<NoPayrollResult>>(`${variationBase}/${input.id}/no-payroll`, {
    reason: input.reason,
  });
  return response.data;
}

/** SUPER_ADMIN: undoes a no payroll while the next month has no voucher (e.g. the voucher turned up late). */
export async function revertNoPayroll(input: { id: string; reason: string }) {
  const response = await api.delete<ApiRes<NoPayrollRevertResult>>(`${variationBase}/${input.id}/no-payroll`, {
    data: { reason: input.reason },
  });
  return response.data;
}

/**
 * SUPER_ADMIN: steps a generated, unlocked variation back one version (version 1: removes it), putting its deductions
 * back to what that version had.
 */
export async function revertVariation(input: { id: string; reason: string }) {
  const response = await api.post<ApiRes<RevertVariationResult>>(`${variationBase}/${input.id}/revert`, {
    reason: input.reason,
  });
  return response.data;
}

/** Whether a YYYY-MM month is over on the Lagos calendar (UTC+1 all year): from midnight on the next month's 1st. */
export function monthEnded(ym: string): boolean {
  const [year, month] = ym.split("-").map(Number);
  return Date.now() >= Date.UTC(year, month, 1) - 60 * 60 * 1000;
}

/** The current Lagos month as YYYY-MM. */
export function currentLagosMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Africa/Lagos",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}`;
}

/** A YYYY-MM month `count` months on (negative: earlier). */
export function addMonths(ym: string, count: number): string {
  const [year, month] = ym.split("-").map(Number);
  const index = year * 12 + (month - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** "2026-10" as "October 2026". */
export function monthTitle(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}
