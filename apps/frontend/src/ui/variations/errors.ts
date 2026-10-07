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

