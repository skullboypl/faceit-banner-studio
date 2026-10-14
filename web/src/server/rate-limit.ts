type Options = { perSecond?: number; perMinute: number; now?: () => number };

/**
 * Sliding-window limiter kept in process memory. Returns true when the request is allowed;
 * blocked requests are not recorded, so hammering does not extend the block.
 */
export function createRateLimiter({ perSecond, perMinute, now = Date.now }: Options) {
  const hits = new Map<string, number[]>();

  return (key: string): boolean => {
    const current = now();
    const recent = (hits.get(key) ?? []).filter((time) => current - time < 60_000);

    const lastSecond = recent.filter((time) => current - time < 1_000).length;
    const allowed = recent.length < perMinute && (perSecond === undefined || lastSecond < perSecond);
    if (allowed) recent.push(current);

    if (recent.length > 0) hits.set(key, recent);
    else hits.delete(key);

    if (hits.size > 10_000) {
      for (const [other, times] of hits) {
        if (times.every((time) => current - time >= 60_000)) hits.delete(other);
      }
    }
    return allowed;
  };
}
