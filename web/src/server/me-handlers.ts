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
import { createContentGate } from './content-gate';
import { fail, guard, isFail, json, readBody, type Fail } from './http';
import { createLimits } from './limits';
import { getWorkspace, putWorkspace } from './workspace';

const schema = schemaJson as SettingsSchema;
const DEVICE_ID = /^[A-Za-z0-9_-]{1,64}$/;

type Ctx = { params: Promise<{ id: string }> };

export function createMeHandlers(options: { unlimited?: boolean } = {}) {
  const limits = createLimits(options.unlimited);
  const gate = createContentGate();
  const workspaceLimit = limits.workspace;
  const bannerLimit = limits.banner;

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
        const user = await guard(request, { ip: limits.ip });
        if (isFail(user)) return user.response;
        return json(200, { workspace: await getWorkspace(user.guid) });
      }),

    putWorkspace: (request: Request) =>
      run(async () => {
        const user = await guard(request, { write: true, ip: limits.ip, limiter: workspaceLimit, retryAfter: '2' });
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
        const user = await guard(request, { ip: limits.ip });
        if (isFail(user)) return user.response;
        return json(200, { banners: await listBanners(user.guid), limit: MAX_BANNERS_PER_USER });
      }),

    createBanner: (request: Request) =>
      run(async () => {
        const user = await guard(request, { write: true, ip: limits.ip, limiter: bannerLimit, retryAfter: '30' });
        if (isFail(user)) return user.response;
        const body = await readBody(request);
        if (isFail(body)) return body.response;
        const blocked = gate.screen(user.guid, typeof body.name === 'string' ? [{ text: body.name, kind: 'name' }] : []);
        if (blocked) return blocked;
        if (typeof body.name !== 'string') return fail(400, 'invalid_name', 'name is required.').response;
        const settings = validSettings(body.settings);
        if (isFail(settings)) return settings.response;
        return json(201, { banner: await createBanner(user.guid, body.name, settings) });
      }),

    updateBanner: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await guard(request, { write: true, ip: limits.ip, limiter: bannerLimit, retryAfter: '30' });
        if (isFail(user)) return user.response;
        const body = await readBody(request);
        if (isFail(body)) return body.response;

        const patch: { name?: string; settings?: Record<string, unknown> } = {};
        if (body.name !== undefined) {
          if (typeof body.name !== 'string') return fail(400, 'invalid_name', 'name must be a string.').response;
          const blocked = gate.screen(user.guid, [{ text: body.name, kind: 'name' }]);
          if (blocked) return blocked;
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
        const user = await guard(request, { write: true, ip: limits.ip, limiter: bannerLimit, retryAfter: '30' });
        if (isFail(user)) return user.response;
        const removed = await deleteBanner(user.guid, (await ctx.params).id);
        return removed ? json(200, { ok: true }) : fail(404, 'not_found', 'Banner not found.').response;
      }),
  };
}
