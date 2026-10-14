import { clientIp } from '../../../shared/client-ip.mjs';
import { createRateLimiter, type RateLimiterOptions } from '../../../shared/rate-limit.mjs';

const LOCKOUT = { strikes: 5, windowMs: 5 * 60_000, blockMs: 15 * 60_000 };

/** Every limit of the Next.js API in one place; deliberately tight. */
export const POLICY = {
  /** Any request, per client IP. Repeated rejections lock the IP out for 15 minutes. */
  ipRead: { perMinute: 120, blockAfter: LOCKOUT },
  ipWrite: { perMinute: 20, blockAfter: LOCKOUT },
  /** Per logged-in user. */
  post: { perMinute: 3, perHour: 3, perDay: 10 },
  comment: { perMinute: 6, perHour: 40 },
  vote: { perMinute: 20, perHour: 200 },
  banner: { perMinute: 12, perHour: 120 },
  workspace: { perSecond: 1, perMinute: 40 },
  admin: { perMinute: 120 },
} satisfies Record<string, RateLimiterOptions>;

export type Limiter = (key: string) => boolean;

const trustedHops = () => Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);

export function createLimits(unlimited = false) {
  const allow: Limiter = () => true;
  const make = (options: RateLimiterOptions): Limiter => (unlimited ? allow : createRateLimiter(options));
  const ipRead = make(POLICY.ipRead);
  const ipWrite = make(POLICY.ipWrite);

  return {
    /** Per-IP check for a request; writes are limited harder than reads. */
    ip: (request: Request, write: boolean) =>
      (write ? ipWrite : ipRead)(clientIp(request.headers, undefined, trustedHops())),
    post: make(POLICY.post),
    comment: make(POLICY.comment),
    vote: make(POLICY.vote),
    banner: make(POLICY.banner),
    workspace: make(POLICY.workspace),
    admin: make(POLICY.admin),
  };
}

export type Limits = ReturnType<typeof createLimits>;
