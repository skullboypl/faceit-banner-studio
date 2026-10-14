import { DEV_ADMIN_USER, localDevAdmin } from './dev-admin';
import { getSessionUser } from './session';
import { upsertUser, type SessionUser } from './repo-users';

export const MAX_BODY_BYTES = 32_768;

export type Fail = { response: Response };

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export const fail = (status: number, error: string, message: string, extra: Record<string, unknown> = {}): Fail => ({
  response: json(status, { error, message, ...extra }),
});

export const isFail = (value: unknown): value is Fail =>
  typeof value === 'object' && value !== null && 'response' in value;

/** PUBLIC_URL may list several origins (comma separated), e.g. local http and https. */
const allowedOrigins = (): string[] =>
  String(process.env.PUBLIC_URL ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    });

/** Same-origin check for state-changing requests (CSRF). Browsers always send Origin on these. */
export function originAllowed(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  if (localDevAdmin(request)) {
    try {
      const host = new URL(origin).hostname;
      if (host === '127.0.0.1' || host === 'localhost' || host === '::1') return true;
    } catch {
      return false;
    }
  }
  try {
    return allowedOrigins().includes(new URL(origin).origin);
  } catch {
    return false;
  }
}

/** Reads at most MAX_BODY_BYTES; stops (and cancels the upload) as soon as the limit is crossed. */
async function readLimited(request: Request): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function readBody(request: Request): Promise<Record<string, unknown> | Fail> {
  const tooLarge = () => fail(413, 'payload_too_large', 'Request body is too large.');
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return tooLarge();
  const text = await readLimited(request);
  if (text === null) return tooLarge();
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch {
    return fail(400, 'invalid_json', 'Request body must be a JSON object.');
  }
}

export const adminGuids = (): string[] =>
  String(process.env.ADMIN_FACEIT_GUIDS || process.env.ADMIN_FACEIT_GUID || '')
    .split(',')
    .map((guid) => guid.trim().toLowerCase())
    .filter(Boolean);

export const isAdmin = (user: { guid: string } | null): boolean =>
  Boolean(
    (user?.guid === DEV_ADMIN_USER.guid && process.env.DEV_ADMIN === '1' && process.env.NODE_ENV !== 'production') ||
      (user && adminGuids().includes(user.guid.toLowerCase()))
  );

export type GuardOptions = {
  write?: boolean;
  /** Per-IP check, run before anything else so floods never reach the session store. */
  ip?: (request: Request, write: boolean) => boolean;
  limiter?: (key: string) => boolean;
  retryAfter?: string;
  admin?: boolean;
  unauthorizedCode?: string;
};

/** Origin (writes) → session → admin → rate limit → account row. */
export const tooManyRequests = (retryAfter = '60'): Response =>
  json(429, { error: 'rate_limited', message: 'Too many requests, slow down.' }, { 'retry-after': retryAfter });

export async function guard(request: Request, options: GuardOptions = {}): Promise<SessionUser | Fail> {
  if (options.ip && !options.ip(request, Boolean(options.write))) return { response: tooManyRequests('60') };
  if (options.write && !originAllowed(request)) return fail(403, 'bad_origin', 'Cross-origin request rejected.');
  const user = await getSessionUser(request);
  if (!user) return fail(401, options.unauthorizedCode ?? 'unauthorized', 'Log in with FACEIT first.');
  if (options.admin && !isAdmin(user)) return fail(403, 'forbidden', 'Admin access required.');
  if (options.limiter && !options.limiter(user.guid)) {
    return {
      response: json(
        429,
        { error: 'rate_limited', message: 'Too many requests, slow down.' },
        { 'retry-after': options.retryAfter ?? '2' }
      ),
    };
  }
  await upsertUser(user);
  return user;
}
