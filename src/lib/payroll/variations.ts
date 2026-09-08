import { api } from "@/lib/axios";

export const variationFilterLabels = {
  ALL: "All changes",
  NEW_LOAN: "New loans",
  TOPUP: "Top-ups",
  LIQUIDATION: "Liquidations (partial and full)",
  TENURE_CHANGE: "Tenure changes",
  COMBINED: "All three: top-up, liquidation and tenure change",
} as const;
export type VariationFilter = keyof typeof variationFilterLabels;

export type VariationRow = {
  borrowerId: string;
  externalId: string;
  borrowerName: string;
  action: "START" | "AMEND" | "STOP";
  reasons: string[];
  changeTypes: string[];
  previousAmount: string | null;
  amount: string;
  termRemaining: number;
  effectiveFromPeriod: string;
  endDate: string | null;
};
export type VariationPreview = {
  period: string;
  rows: VariationRow[];
  previewHash: string;
  changeFilter: VariationFilter;
  totalChangeCount: number;
  excludedCount: number;
  counts: { start: number; amend: number; stop: number };
  unchangedCount: number;
  totalAmount: string;
  issues: { borrowerId: string; name: string; message: string }[];
};
export type VariationBatch = {
  id: string;
  period: string;
  version: number;
  kind: "BASELINE" | "NO_CHANGES" | "VARIATION";
  status: "DRAFT" | "PREPARED" | "SENT";
  rows: VariationRow[];
  changeFilter: VariationFilter | null;
  excludedCount: number;
  note: string | null;
  recipientEmail: string | null;
  submissionReference: string | null;
  emailedAt: string | null;
  emailError: string | null;
  artifactHash: string | null;
};
export type VariationState = {
  initialized: boolean;
  pending: VariationBatch | null;
  history: VariationBatch[];
  legacySchedules: {
    id: string;
    period: string;
    version: number;
    rowCount: number;
  }[];
};
export const variationBase = "/admin/payroll-variations";
export const variationStateKey = [variationBase];
export async function getVariationState() {
  const response = await api.get<ApiRes<VariationState>>(variationBase);
  if (!response.data.data)
    throw new Error("Variation history could not be loaded");
  return response.data.data;
}
export async function previewVariation(input: {
  period: string;
  changeFilter: VariationFilter;
}) {
  const response = await api.post<ApiRes<VariationPreview>>(
    `${variationBase}/preview`,
    input,
  );
  if (!response.data.data)
    throw new Error("Variation preview could not be loaded");
  return response.data.data;
}
export async function variationAction(input: {
  path: string;
  data: Record<string, unknown>;
}) {
  const response = await api.post<ApiRes<unknown>>(
    `${variationBase}/${input.path}`,
    input.data,
  );
  return response.data;
}
