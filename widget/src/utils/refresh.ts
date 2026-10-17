/** A banner never reads FACEIT more often than this: it protects the rate limit of every banner at once. */
export const MIN_REFRESH_SECONDS = 30;

/** Seconds between two reads: the chosen value, never below the minimum. A missing or broken value is a minute. */
export function refreshSeconds(value: unknown): number {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return 60;
  return Math.max(MIN_REFRESH_SECONDS, seconds);
}
