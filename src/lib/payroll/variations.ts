import { api } from "@/lib/axios";

export type VariationRow = {
  borrowerId: string;
  externalId: string;
  borrowerName: string;
  action: "START" | "AMEND" | "STOP";
  reasons: string[];
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
export async function previewVariation(period: string) {
  const response = await api.post<ApiRes<VariationPreview>>(
    `${variationBase}/preview`,
    { period },
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
