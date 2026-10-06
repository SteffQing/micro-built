import { api } from "@/lib/axios";

export type VariationAction = "START" | "AMEND" | "STOP";
export type VariationReason =
  | "NEW_LOAN"
  | "TOPUP"
  | "LIQUIDATION"
  | "TENURE_CHANGE"
  | "DEFAULT";

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

export type VariationPeriod = {
  id: string;
  label: string;
  ym: string;
  submittedAt: string | null;
  closedAt: string | null;
  hasFile: boolean;
  /** Why a submitted month can't be reverted; null when it can. */
  revertBlockedBy: string | null;
};

export type VariationCounts = Record<VariationAction, number>;

export type VariationPreview = {
  period: VariationPeriod;
  rows: VariationRow[];
  counts: VariationCounts;
};

export type VariationFilters = {
  action?: VariationAction;
  reason?: VariationReason;
};

export type VariationSubmitResult = {
  periodId: string;
  period: string;
  counts: VariationCounts;
  frozen: number;
  opened: number;
};

export const variationBase = "/admin/payroll-variations";
export const variationKey = (period: string) => [variationBase, period];
export const variationPreviewKey = (
  period: string,
  filters: VariationFilters = {},
) => [variationBase, period, filters.action ?? null, filters.reason ?? null];

export async function getVariationPreview(
  period: string,
  filters: VariationFilters = {},
) {
  const response = await api.get<ApiRes<VariationPreview>>(variationBase, {
    params: { period, action: filters.action, reason: filters.reason },
  });
  if (!response.data.data)
    throw new Error("The variation preview could not be loaded");
  return response.data.data;
}

/** Emails a draft of the month's file to the signed-in admin. */
export async function generateVariation(input: { period: string }) {
  const response = await api.post<
    ApiRes<{ period: string; email: string }>
  >(`${variationBase}/generate`, input);
  return response.data;
}

export async function submitVariation(input: { period: string }) {
  const response = await api.post<ApiRes<VariationSubmitResult>>(
    `${variationBase}/submit`,
    input,
  );
  return response.data;
}

export async function revertVariation(input: { period: string; reason: string; code: string }) {
  const response = await api.post<
    ApiRes<{ periodId: string; period: string; reopened: number; removed: number }>
  >(`${variationBase}/revert`, input);
  return response.data;
}

export async function getVariationFile(period: string) {
  const response = await api.get<ApiRes<{ url: string; expiresIn: number }>>(
    `${variationBase}/file`,
    { params: { period } },
  );
  if (!response.data.data) throw new Error("The file link could not be created");
  return response.data.data;
}
