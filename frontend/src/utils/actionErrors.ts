/**
 * Normalizes errors from Wails / Go into a single user-facing sentence.
 */
export function formatBackendError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (error instanceof Error) {
    const msg = error.message.trim();
    if (msg) return msg;
  }
  if (typeof error === 'string') {
    const msg = error.trim();
    if (msg) return msg;
  }
  return fallback;
}
