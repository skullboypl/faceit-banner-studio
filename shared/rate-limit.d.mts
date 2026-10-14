export type RateLimiterOptions = {
  perSecond?: number;
  perMinute?: number;
  perHour?: number;
  perDay?: number;
  /** After `strikes` rejections within `windowMs` the key is locked out for `blockMs`. */
  blockAfter?: { strikes: number; windowMs: number; blockMs: number };
  now?: () => number;
};

/** Returns a function that answers "may this key proceed right now?" and records the request when it may. */
export function createRateLimiter(options: RateLimiterOptions): (key: string) => boolean;
