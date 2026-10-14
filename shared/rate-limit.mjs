/**
 * Sliding-window rate limiter kept in process memory, shared by the Node server and the Next.js app.
 * Only allowed requests are recorded, so a flood cannot grow memory; rejections count as "strikes" and
 * enough of them lock the key out for `blockMs` (a cooldown that repeated abuse cannot wait out).
 */
const SECOND = 1_000;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export function createRateLimiter({ perSecond, perMinute, perHour, perDay, blockAfter, now = Date.now }) {
  const windows = [
    [SECOND, perSecond],
    [MINUTE, perMinute],
    [HOUR, perHour],
    [DAY, perDay],
  ].filter(([, max]) => max !== undefined);
  const longest = windows.reduce((max, [size]) => Math.max(max, size), MINUTE);

  const hits = new Map();
  const strikes = new Map();
  const blocked = new Map();

  const sweep = (current) => {
    for (const [key, times] of hits) {
      if (times.every((time) => current - time >= longest) && !(blocked.get(key) > current)) hits.delete(key);
    }
    for (const [key, until] of blocked) if (until <= current) blocked.delete(key);
    for (const [key, times] of strikes) {
      if (times.every((time) => current - time >= (blockAfter?.windowMs ?? 0))) strikes.delete(key);
    }
  };

  return (key) => {
    const current = now();
    if ((blocked.get(key) ?? 0) > current) return false;

    const recent = (hits.get(key) ?? []).filter((time) => current - time < longest);
    const allowed = windows.every(([size, max]) => recent.filter((time) => current - time < size).length < max);

    if (allowed) {
      recent.push(current);
    } else if (blockAfter) {
      const recentStrikes = (strikes.get(key) ?? []).filter((time) => current - time < blockAfter.windowMs);
      recentStrikes.push(current);
      strikes.set(key, recentStrikes);
      if (recentStrikes.length >= blockAfter.strikes) {
        blocked.set(key, current + blockAfter.blockMs);
        strikes.delete(key);
      }
    }

    if (recent.length > 0) hits.set(key, recent);
    else hits.delete(key);
    if (hits.size + strikes.size + blocked.size > 10_000) sweep(current);
    return allowed;
  };
}
