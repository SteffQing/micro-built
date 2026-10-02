/**
 * Extract a human-readable message from a better-auth / react-query error.
 *
 * Better-auth mutations throw `Error` instances whose `message` comes from
 * `res.error.message` (or falls back to a generic string).  The old code
 * checked for `AxiosError` which is no longer used now that auth is
 * cookie-based via the Better Auth client.
 */
const getErrorMessage = (error: unknown, defaultMessage: string): string => {
  if (error instanceof Error) {
    return error.message || defaultMessage;
  }
  return defaultMessage;
};

export default getErrorMessage;
