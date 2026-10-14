import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { TEST_DATABASE_URL, TEST_REDIS_URL } from './test-env';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.REDIS_URL = TEST_REDIS_URL;
process.env.PUBLIC_URL = 'http://localhost:5173';

type Handlers = ReturnType<typeof import('./me-handlers').createMeHandlers>;
let handlers: Handlers;
let redis: typeof import('./redis');
let db: typeof import('./db');

const ORIGIN = 'http://localhost:5173';
const alice = { guid: 'guid-alice', nickname: 'alice', avatar: null };
const bob = { guid: 'guid-bob', nickname: 'bob', avatar: null };

async function login(user: { guid: string; nickname: string; avatar: null }) {
  const id = randomBytes(24).toString('hex');
  await (await redis.getRedis())!.set(`fb:session:${id}`, JSON.stringify(user), 'EX', 600);
  return `fb_session=${id}`;
}

const call = (
  method: string,
  path: string,
  { cookie, body, origin = ORIGIN, raw }: { cookie?: string; body?: unknown; origin?: string | null; raw?: string } = {}
) =>
  new Request(`http://localhost:3100${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
      'content-type': 'application/json',
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });

type Json = {
  error?: string;
  version?: number;
  workspace?: { version?: number; settings?: unknown } | null;
  banner?: { id?: string; name?: string; settings?: unknown };
  banners?: { id?: string; name?: string }[];
  [key: string]: unknown;
};
const json = async (response: Response) => response.json() as Promise<Json>;
const withId = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  redis = await import('./redis');
  db = await import('./db');
  const { createMeHandlers } = await import('./me-handlers');
  handlers = createMeHandlers({ unlimited: true });
});

beforeEach(async () => {
  await (await redis.getRedis())!.flushdb();
  await (await db.getPool())!.query('TRUNCATE saved_banners, user_workspace, users CASCADE');
});

afterAll(async () => {
  await (await redis.getRedis())?.quit();
  await (await db.getPool())?.end();
});

describe('authentication and origin', () => {
  test('401 without a session', async () => {
    expect((await handlers.listBanners(call('GET', '/api/me/banners'))).status).toBe(401);
    expect((await handlers.getWorkspace(call('GET', '/api/me/workspace'))).status).toBe(401);
  });

  test('401 for a session cookie that is not a valid id', async () => {
    const response = await handlers.listBanners(call('GET', '/api/me/banners', { cookie: 'fb_session=../../etc' }));
    expect(response.status).toBe(401);
  });

  test('403 when Origin does not match PUBLIC_URL on a write', async () => {
    const cookie = await login(alice);
    const body = { settings: {}, deviceId: 'd1', baseVersion: 0 };
    for (const origin of ['https://evil.example', null]) {
      const response = await handlers.putWorkspace(call('PUT', '/api/me/workspace', { cookie, body, origin }));
      expect(response.status).toBe(403);
    }
  });
});

describe('workspace', () => {
  test('GET returns null for a new user', async () => {
    const cookie = await login(alice);
    const response = await handlers.getWorkspace(call('GET', '/api/me/workspace', { cookie }));
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ workspace: null });
  });

  test('PUT stores the delta and GET returns it with the version', async () => {
    const cookie = await login(alice);
    const put = await handlers.putWorkspace(
      call('PUT', '/api/me/workspace', { cookie, body: { settings: { bannerRadius: 20 }, deviceId: 'd1', baseVersion: 0 } })
    );
    expect(put.status).toBe(200);
    expect(await json(put)).toEqual({ version: 1 });
    const get = await json(await handlers.getWorkspace(call('GET', '/api/me/workspace', { cookie })));
    expect(get.workspace).toEqual({ settings: { bannerRadius: 20 }, version: 1, deviceId: 'd1' });
  });

  test('409 with the current state on a stale base from another device', async () => {
    const cookie = await login(alice);
    const put = (deviceId: string, baseVersion: number, radius: number) =>
      handlers.putWorkspace(
        call('PUT', '/api/me/workspace', { cookie, body: { settings: { bannerRadius: radius }, deviceId, baseVersion } })
      );
    await put('d1', 0, 5);
    const response = await put('d2', 0, 9);
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({
      error: 'conflict',
      current: { settings: { bannerRadius: 5 }, version: 1, deviceId: 'd1' },
    });
  });

  test('400 for an invalid delta, a bad deviceId and a bad baseVersion', async () => {
    const cookie = await login(alice);
    const put = (body: unknown) => handlers.putWorkspace(call('PUT', '/api/me/workspace', { cookie, body }));
    expect((await put({ settings: { bannerRadius: 999 }, deviceId: 'd1', baseVersion: 0 })).status).toBe(400);
    expect((await put({ settings: {}, deviceId: 'bad id!', baseVersion: 0 })).status).toBe(400);
    expect((await put({ settings: {}, deviceId: 'd1', baseVersion: -1 })).status).toBe(400);
    expect((await put({ settings: {}, deviceId: 'd1', baseVersion: 1.5 })).status).toBe(400);
  });

  test('400 for malformed JSON and for a __proto__ key', async () => {
    const cookie = await login(alice);
    const malformed = await handlers.putWorkspace(call('PUT', '/api/me/workspace', { cookie, raw: '{nope' }));
    expect(malformed.status).toBe(400);
    const proto = await handlers.putWorkspace(
      call('PUT', '/api/me/workspace', { cookie, raw: '{"settings":{"__proto__":{"x":1}},"deviceId":"d1","baseVersion":0}' })
    );
    expect(proto.status).toBe(400);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  test('413 for a body over 32768 bytes', async () => {
    const cookie = await login(alice);
    const response = await handlers.putWorkspace(
      call('PUT', '/api/me/workspace', { cookie, raw: JSON.stringify({ pad: 'a'.repeat(33000) }) })
    );
    expect(response.status).toBe(413);
  });

  test('413 and an early stop for a chunked body with no Content-Length', async () => {
    const cookie = await login(alice);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(8192).fill(97));
        sent += 8192;
        if (sent >= 50 * 1024 * 1024) controller.close();
      },
    });
    const request = new Request('http://localhost:3100/api/me/workspace', {
      method: 'PUT',
      headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' },
      body: stream,
      // @ts-expect-error Node needs duplex for streamed request bodies
      duplex: 'half',
    });
    const response = await handlers.putWorkspace(request);
    expect(response.status).toBe(413);
    expect(sent).toBeLessThan(1024 * 1024);
  });

  test('429 on a second write within one second with the default limits', async () => {
    const { createMeHandlers } = await import('./me-handlers');
    const limited = createMeHandlers();
    const cookie = await login(alice);
    const body = { settings: {}, deviceId: 'd1', baseVersion: 0 };
    const put = () => limited.putWorkspace(call('PUT', '/api/me/workspace', { cookie, body }));
    expect((await put()).status).toBe(200);
    const second = await put();
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).not.toBeNull();
  });
});

describe('banners', () => {
  const create = (cookie: string, name: string, settings: unknown = { bannerRadius: 12 }) =>
    handlers.createBanner(call('POST', '/api/me/banners', { cookie, body: { name, settings } }));

  test('POST creates, GET lists with the limit, settings stay a delta', async () => {
    const cookie = await login(alice);
    const created = await create(cookie, 'Main', { bannerRadius: 12 });
    expect(created.status).toBe(201);
    const list = await json(await handlers.listBanners(call('GET', '/api/me/banners', { cookie })));
    expect(list.limit).toBe(25);
    expect(list.banners).toHaveLength(1);
    expect(list.banners[0]).toMatchObject({ name: 'Main', settings: { bannerRadius: 12 } });
  });

  test('400 for an invalid delta and for an invalid name', async () => {
    const cookie = await login(alice);
    expect((await create(cookie, 'ok', { bannerRadius: 999 })).status).toBe(400);
    expect((await create(cookie, '')).status).toBe(400);
    expect((await create(cookie, 'a'.repeat(61))).status).toBe(400);
  });

  test('409 on a duplicate name and on the 26th banner', async () => {
    const cookie = await login(alice);
    await create(cookie, 'dup');
    const duplicate = await create(cookie, 'DUP');
    expect(duplicate.status).toBe(409);
    expect((await json(duplicate)).error).toBe('duplicate_name');
    for (let i = 0; i < 24; i++) await create(cookie, `b${i}`);
    const over = await create(cookie, 'one too many');
    expect(over.status).toBe(409);
    expect((await json(over)).error).toBe('banner_limit');
  });

  test("PATCH and DELETE another user's id return 404", async () => {
    const aliceCookie = await login(alice);
    const bobCookie = await login(bob);
    const { banner } = await json(await create(aliceCookie, 'mine'));
    const patch = await handlers.updateBanner(
      call('PATCH', `/api/me/banners/${banner.id}`, { cookie: bobCookie, body: { name: 'stolen' } }),
      withId(banner.id)
    );
    expect(patch.status).toBe(404);
    const del = await handlers.deleteBanner(call('DELETE', `/api/me/banners/${banner.id}`, { cookie: bobCookie }), withId(banner.id));
    expect(del.status).toBe(404);
    const list = await json(await handlers.listBanners(call('GET', '/api/me/banners', { cookie: aliceCookie })));
    expect(list.banners[0].name).toBe('mine');
  });

  test('PATCH renames and overwrites; DELETE removes', async () => {
    const cookie = await login(alice);
    const { banner } = await json(await create(cookie, 'old'));
    const patched = await handlers.updateBanner(
      call('PATCH', `/api/me/banners/${banner.id}`, { cookie, body: { name: 'new', settings: { bannerRadius: 3 } } }),
      withId(banner.id)
    );
    expect(patched.status).toBe(200);
    expect((await json(patched)).banner).toMatchObject({ name: 'new', settings: { bannerRadius: 3 } });
    const deleted = await handlers.deleteBanner(call('DELETE', `/api/me/banners/${banner.id}`, { cookie }), withId(banner.id));
    expect(deleted.status).toBe(200);
  });

  test('a profane name is 400 content_blocked and the word is not quoted', async () => {
    const { createMeHandlers } = await import('./me-handlers');
    const gated = createMeHandlers({ unlimited: true });
    const cookie = await login(alice);
    const response = await gated.createBanner(call('POST', '/api/me/banners', { cookie, body: { name: 'my shit banner', settings: {} } }));
    const payload = await json(response);
    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'content_blocked', category: 'profanity' });
    expect(JSON.stringify(payload).toLowerCase()).not.toContain('shit');

    const { banner } = await json(await create(cookie, 'Main'));
    const renamed = await gated.updateBanner(
      call('PATCH', `/api/me/banners/${banner.id}`, { cookie, body: { name: 'fuck this' } }),
      withId(banner.id)
    );
    const renamedBody = await json(renamed);
    expect(renamed.status).toBe(400);
    expect(renamedBody.category).toBe('profanity');
    expect(JSON.stringify(renamedBody).toLowerCase()).not.toContain('fuck');
  });

  test('five blocked names lock the next rename', async () => {
    const { createMeHandlers } = await import('./me-handlers');
    const gated = createMeHandlers({ unlimited: true });
    const cookie = await login(bob);
    const { banner } = await json(await create(cookie, 'Main'));
    const rename = () =>
      gated.updateBanner(call('PATCH', `/api/me/banners/${banner.id}`, { cookie, body: { name: 'shit banner' } }), withId(banner.id));
    for (let i = 0; i < 5; i++) expect((await rename()).status).toBe(400);
    const locked = await gated.updateBanner(
      call('PATCH', `/api/me/banners/${banner.id}`, { cookie, body: { name: 'Clean name' } }),
      withId(banner.id)
    );
    expect(locked.status).toBe(429);
    expect((await json(locked)).error).toBe('writing_locked');
    expect(Number(locked.headers.get('retry-after'))).toBeGreaterThan(3000);
  });

  test('PATCH with no fields is a 400', async () => {
    const cookie = await login(alice);
    const { banner } = await json(await create(cookie, 'x'));
    const response = await handlers.updateBanner(
      call('PATCH', `/api/me/banners/${banner.id}`, { cookie, body: {} }),
      withId(banner.id)
    );
    expect(response.status).toBe(400);
  });
});
