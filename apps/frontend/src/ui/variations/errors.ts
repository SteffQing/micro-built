import { isAxiosError } from "axios";

/** The API's message (or messages) for a failed request, in words people can act on. */
export function errorMessage(error: unknown): string {
  const message = isAxiosError(error)
    ? error.response?.data?.message
    : error instanceof Error
      ? error.message
      : null;
  return Array.isArray(message)
    ? message.join(". ")
    : typeof message === "string"
      ? message
      : "Could not complete this request. Please retry.";
}

/**
 * A voucher refused because the organization has earlier months still waiting for their voucher: the 409 lists them
 * (PLAN_V2 §2) so the page can offer "No payroll" for each and try again.
 */
export function earlierUnlockedOf(error: unknown): EarlierUnlockedVariation[] {
  if (!isAxiosError(error) || error.response?.status !== 409) return [];
  const list = (error.response.data as { earlierUnlocked?: unknown })?.earlierUnlocked;
  return Array.isArray(list) ? (list as EarlierUnlockedVariation[]) : [];
}
