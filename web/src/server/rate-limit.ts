type Options = { perSecond?: number; perMinute: number; perHour?: number; now?: () => number };

/**
 * Sliding-window limiter kept in process memory. Returns true when the request is allowed;
 * blocked requests are not recorded, so hammering does not extend the block.
 */
export function createRateLimiter({ perSecond, perMinute, perHour, now = Date.now }: Options) {
  const hits = new Map<string, number[]>();

  return (key: string): boolean => {
    const current = now();
    const window = perHour === undefined ? 60_000 : 3_600_000;
    const recent = (hits.get(key) ?? []).filter((time) => current - time < window);

    const inLast = (ms: number) => recent.filter((time) => current - time < ms).length;
    const allowed =
      inLast(60_000) < perMinute &&
      (perSecond === undefined || inLast(1_000) < perSecond) &&
      (perHour === undefined || recent.length < perHour);
    if (allowed) recent.push(current);

    if (recent.length > 0) hits.set(key, recent);
    else hits.delete(key);

    if (hits.size > 10_000) {
      for (const [other, times] of hits) {
        if (times.every((time) => current - time >= window)) hits.delete(other);
      }
    }
    return allowed;
  };
}
