import schemaJson from '../../../shared/settings-schema.json';
import { validateDelta, type SettingsSchema } from '../../../shared/settings-delta.mjs';
import {
  BannerLimitError,
  DuplicateNameError,
  InvalidNameError,
  MAX_BANNERS_PER_USER,
  createBanner,
  deleteBanner,
  listBanners,
  updateBanner,
} from './repo-banners';
import { createRateLimiter } from './rate-limit';
import { upsertUser, type SessionUser } from './repo-users';
import { getSessionUser } from './session';
import { getWorkspace, putWorkspace } from './workspace';

const schema = schemaJson as SettingsSchema;
const MAX_BODY_BYTES = 32_768;
const DEVICE_ID = /^[A-Za-z0-9_-]{1,64}$/;

type Ctx = { params: Promise<{ id: string }> };
type Fail = { response: Response };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

const fail = (status: number, error: string, message: string, extra: Record<string, unknown> = {}): Fail => ({
  response: json(status, { error, message, ...extra }),
});

const isFail = (value: unknown): value is Fail => typeof value === 'object' && value !== null && 'response' in value;

/** Same-origin check for state-changing requests (CSRF). Browsers always send Origin on these. */
function originAllowed(request: Request): boolean {
  const publicUrl = process.env.PUBLIC_URL;
  const origin = request.headers.get('origin');
  if (!publicUrl || !origin) return false;
  try {
    return new URL(origin).origin === new URL(publicUrl).origin;
  } catch {
    return false;
  }
}

async function readBody(request: Request): Promise<Record<string, unknown> | Fail> {
  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_BODY_BYTES) return fail(413, 'payload_too_large', 'Request body is too large.');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return fail(413, 'payload_too_large', 'Request body is too large.');
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch {
    return fail(400, 'invalid_json', 'Request body must be a JSON object.');
  }
}

export function createMeHandlers(options: { unlimited?: boolean } = {}) {
  const allowAll = () => true;
  const workspaceLimit = options.unlimited ? allowAll : createRateLimiter({ perSecond: 1, perMinute: 60 });
  const bannerLimit = options.unlimited ? allowAll : createRateLimiter({ perMinute: 30 });

  /** Origin (writes) → session → account row → optional rate limit. */
  async function guard(
    request: Request,
    opts: { write: boolean; limiter?: (key: string) => boolean; retryAfter?: string }
  ): Promise<SessionUser | Fail> {
    if (opts.write && !originAllowed(request)) return fail(403, 'bad_origin', 'Cross-origin request rejected.');
    const user = await getSessionUser(request);
    if (!user) return fail(401, 'unauthorized', 'Log in with FACEIT first.');
    if (opts.limiter && !opts.limiter(user.guid)) {
      return {
        response: json(
          429,
          { error: 'rate_limited', message: 'Too many requests, slow down.' },
          { 'retry-after': opts.retryAfter ?? '2' }
        ),
      };
    }
    await upsertUser(user);
    return user;
  }

  const run = async (work: () => Promise<Response>): Promise<Response> => {
    try {
      return await work();
    } catch (error) {
      if (error instanceof InvalidNameError) return fail(400, 'invalid_name', error.message).response;
      if (error instanceof DuplicateNameError) return fail(409, 'duplicate_name', error.message).response;
      if (error instanceof BannerLimitError) {
        return fail(409, 'banner_limit', `You can save up to ${MAX_BANNERS_PER_USER} banners.`).response;
      }
      if ((error as Error).message === 'database_unavailable') {
        return fail(503, 'database_unavailable', 'Storage is temporarily unavailable.').response;
      }
      return fail(500, 'server_error', 'Something went wrong.').response;
    }
  };

  const validSettings = (value: unknown): Record<string, unknown> | Fail => {
    const result = validateDelta(value, schema);
    if (!result.ok) return fail(400, 'invalid_settings', result.errors.join('; '), { errors: result.errors });
    return value as Record<string, unknown>;
  };

  return {
    getWorkspace: (request: Request) =>
      run(async () => {
        const user = await guard(request, { write: false });
        if (isFail(user)) return user.response;
        return json(200, { workspace: await getWorkspace(user.guid) });
      }),

    putWorkspace: (request: Request) =>
      run(async () => {
        const user = await guard(request, { write: true, limiter: workspaceLimit, retryAfter: '2' });
        if (isFail(user)) return user.response;
        const body = await readBody(request);
        if (isFail(body)) return body.response;

        const { deviceId, baseVersion } = body;
        if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) {
          return fail(400, 'invalid_device', 'deviceId must be 1-64 letters, digits, - or _.').response;
        }
        if (!Number.isSafeInteger(baseVersion) || (baseVersion as number) < 0) {
          return fail(400, 'invalid_version', 'baseVersion must be a non-negative integer.').response;
        }
        const settings = validSettings(body.settings);
        if (isFail(settings)) return settings.response;

        const result = await putWorkspace(user.guid, { settings, deviceId, baseVersion: baseVersion as number });
        if (result.status === 'conflict') {
          return json(409, { error: 'conflict', message: 'Newer settings exist in your account.', current: result.current });
        }
        return json(200, { version: result.version });
      }),

    listBanners: (request: Request) =>
      run(async () => {
        const user = await guard(request, { write: false });
        if (isFail(user)) return user.response;
        return json(200, { banners: await listBanners(user.guid), limit: MAX_BANNERS_PER_USER });
      }),

    createBanner: (request: Request) =>
      run(async () => {
        const user = await guard(request, { write: true, limiter: bannerLimit, retryAfter: '30' });
        if (isFail(user)) return user.response;
        const body = await readBody(request);
        if (isFail(body)) return body.response;
        if (typeof body.name !== 'string') return fail(400, 'invalid_name', 'name is required.').response;
        const settings = validSettings(body.settings);
        if (isFail(settings)) return settings.response;
        return json(201, { banner: await createBanner(user.guid, body.name, settings) });
      }),

    updateBanner: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await guard(request, { write: true, limiter: bannerLimit, retryAfter: '30' });
        if (isFail(user)) return user.response;
        const body = await readBody(request);
        if (isFail(body)) return body.response;

        const patch: { name?: string; settings?: Record<string, unknown> } = {};
        if (body.name !== undefined) {
          if (typeof body.name !== 'string') return fail(400, 'invalid_name', 'name must be a string.').response;
          patch.name = body.name;
        }
        if (body.settings !== undefined) {
          const settings = validSettings(body.settings);
          if (isFail(settings)) return settings.response;
          patch.settings = settings;
        }
        if (patch.name === undefined && patch.settings === undefined) {
          return fail(400, 'empty_patch', 'Send a name or settings to change.').response;
        }
        const banner = await updateBanner(user.guid, (await ctx.params).id, patch);
        return banner ? json(200, { banner }) : fail(404, 'not_found', 'Banner not found.').response;
      }),

    deleteBanner: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await guard(request, { write: true, limiter: bannerLimit, retryAfter: '30' });
        if (isFail(user)) return user.response;
        const removed = await deleteBanner(user.guid, (await ctx.params).id);
        return removed ? json(200, { ok: true }) : fail(404, 'not_found', 'Banner not found.').response;
      }),
  };
}
