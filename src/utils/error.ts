/**
 * Safely extract a user-facing message from an unknown error.
 * Avoids leaking stack traces or internal paths.
 */
export function getErrorMessage(
  error: unknown,
  fallback = "Unknown error"
): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}
