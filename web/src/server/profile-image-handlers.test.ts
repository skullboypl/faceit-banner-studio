import { randomBytes } from 'node:crypto';
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { TEST_DATABASE_URL, TEST_REDIS_URL } from './test-env';
import { useObjectClient } from './r2';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.REDIS_URL = TEST_REDIS_URL;
process.env.PUBLIC_URL = 'http://localhost:5173';
process.env.ADMIN_FACEIT_GUIDS = 'guid-root';

type Handlers = ReturnType<typeof import('./profile-image-handlers').createProfileImageHandlers>;
let handlers: Handlers;
let redis: typeof import('./redis');
let db: typeof import('./db');

const ORIGIN = 'http://localhost:5173';
const alice = { guid: 'guid-alice', nickname: 'alice', avatar: null };
const bob = { guid: 'guid-bob', nickname: 'bob', avatar: null };
const carol = { guid: 'guid-carol', nickname: 'carol', avatar: null };
const dave = { guid: 'guid-dave', nickname: 'dave', avatar: null };
const root = { guid: 'guid-root', nickname: 'root', avatar: null };
const r2Names = ['R2_BUCKET', 'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL'] as const;
const stored = new Map<string, Uint8Array>();
const deleted: string[] = [];

async function login(user: typeof alice) {
  const id = randomBytes(24).toString('hex');
  await (await redis.getRedis())!.set(`fb:session:${id}`, JSON.stringify(user), 'EX', 600);
  return `fb_session=${id}`;
}

const png = (width = 600, height = 400) =>
  sharp({ create: { width, height, channels: 3, background: { r: 30, g: 140, b: 220 } } }).png().toBuffer();

const request = (method: string, path: string, { cookie, body, form, origin = ORIGIN }: { cookie?: string; body?: unknown; form?: FormData; origin?: string | null } = {}) =>
  new Request(`http://localhost:3100${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  });

const formWith = (bytes: Buffer, name = 'photo.png') => {
  const form = new FormData();
  form.set('file', new File([new Uint8Array(bytes)], name, { type: 'image/png' }));
  return form;
};

const kindCtx = (kind: string) => ({ params: Promise.resolve({ kind }) });
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const playerCtx = (playerId: string) => ({ params: Promise.resolve({ playerId }) });
type ImageJson = {
  id: string;
  ownerGuid: string;
  kind: string;
  status: string;
  url: string;
  width?: number;
  height?: number;
  rejectReason: string | null;
  nickname?: string;
  reports?: number;
};

const data = async (response: Response) =>
  (await response.json()) as { error?: string; image: ImageJson; images: ImageJson[] };

async function putImage(user: typeof alice, kind: 'avatar' | 'cover' = 'avatar', bytes?: Buffer) {
  const cookie = await login(user);
  const response = await handlers.put(request('PUT', `/api/me/profile-images/${kind}`, { cookie, form: formWith(bytes ?? (await png())) }), kindCtx(kind));
  return { cookie, response, body: await data(response) };
}

async function approve(admin: typeof root, ownerGuid: string, kind: 'avatar' | 'cover' = 'avatar') {
  const adminCookie = await login(admin);
  const list = await data(await handlers.adminList(request('GET', '/api/admin/profile-images?status=pending', { cookie: adminCookie })));
  const row = list.images.find((image: { ownerGuid: string; kind: string }) => image.ownerGuid === ownerGuid && image.kind === kind);
  const response = await handlers.adminReview(request('POST', `/api/admin/profile-images/${row.id}`, { cookie: adminCookie, body: { action: 'approve' } }), idCtx(row.id));
  return response;
}

beforeAll(async () => {
  redis = await import('./redis');
  db = await import('./db');
  const { createProfileImageHandlers } = await import('./profile-image-handlers');
  handlers = createProfileImageHandlers({ unlimited: true });
});

beforeEach(async () => {
  stored.clear();
  deleted.length = 0;
  process.env.R2_BUCKET = 'banners-vxh';
  process.env.R2_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
  process.env.R2_ACCESS_KEY_ID = 'key';
  process.env.R2_SECRET_ACCESS_KEY = 'secret';
  process.env.R2_PUBLIC_URL = 'https://fbstorage.vxh.pl';
  useObjectClient({
    send: async (command: { constructor: { name: string }; input: { Key?: string; Body?: Uint8Array } }) => {
      const key = command.input.Key ?? '';
      if (command.constructor.name === PutObjectCommand.name && command.input.Body) stored.set(key, command.input.Body);
      else {
        stored.delete(key);
        deleted.push(key);
      }
    },
  } as unknown as S3Client);
  await (await redis.getRedis())!.flushdb();
  await (await db.getPool())!.query('TRUNCATE profile_image_reports, profile_images, users CASCADE');
});

afterEach(() => {
  useObjectClient(null);
  for (const name of r2Names) delete process.env[name];
});

afterAll(async () => {
  await (await redis.getRedis())?.quit();
  await (await db.getPool())?.end();
});

describe('uploading', () => {
  test('stores a WebP in R2 under a random key and answers pending', async () => {
    const { response, body } = await putImage(alice);
    expect(response.status).toBe(201);
    expect(body.image).toMatchObject({ kind: 'avatar', status: 'pending', width: 512, height: 512 });
    expect(body.image.url).toMatch(/^https:\/\/fbstorage\.vxh\.pl\/pf\/avatar\/[0-9a-f]{32}\.webp$/);
    expect([...stored.keys()]).toHaveLength(1);
    const meta = await sharp(stored.values().next().value as Uint8Array).metadata();
    expect(meta.format).toBe('webp');
  });

  test('an admin\'s own image is approved immediately', async () => {
    const { body } = await putImage(root);
    expect(body.image.status).toBe('approved');
  });

  test('replacing deletes the previous file from R2', async () => {
    await putImage(alice);
    const first = [...stored.keys()][0];
    const cookie = await login(alice);
    await handlers.put(request('PUT', '/api/me/profile-images/avatar', { cookie, form: formWith(await png(300, 300)) }), kindCtx('avatar'));
    expect(deleted).toContain(first);
    expect(stored.has(first)).toBe(false);
  });

  test('401 without a session, 403 from another origin, 404 for an unknown kind', async () => {
    const form = formWith(await png());
    expect((await handlers.put(request('PUT', '/api/me/profile-images/avatar', { form }), kindCtx('avatar'))).status).toBe(401);
    const cookie = await login(alice);
    expect((await handlers.put(request('PUT', '/api/me/profile-images/avatar', { cookie, form: formWith(await png()), origin: 'https://evil.example' }), kindCtx('avatar'))).status).toBe(403);
    expect((await handlers.put(request('PUT', '/api/me/profile-images/banner', { cookie, form: formWith(await png()) }), kindCtx('banner'))).status).toBe(404);
    expect(stored.size).toBe(0);
  });

  test('refuses what is not an image, whatever the file name says', async () => {
    const cookie = await login(alice);
    const response = await handlers.put(request('PUT', '/api/me/profile-images/cover', { cookie, form: formWith(Buffer.from('<svg/>'), 'x.png') }), kindCtx('cover'));
    expect(response.status).toBe(400);
    expect((await data(response)).error).toBe('bad_type');
    expect(stored.size).toBe(0);
  });

  test('refuses an image above 1 MB with 413', async () => {
    const cookie = await login(alice);
    const response = await handlers.put(request('PUT', '/api/me/profile-images/cover', { cookie, form: formWith(Buffer.alloc(1024 * 1024 + 1, 1)) }), kindCtx('cover'));
    expect(response.status).toBe(413);
  });

  test('refuses a request without a file', async () => {
    const cookie = await login(alice);
    const response = await handlers.put(request('PUT', '/api/me/profile-images/avatar', { cookie, form: new FormData() }), kindCtx('avatar'));
    expect(response.status).toBe(400);
  });

  test('503 when file storage is not configured, and nothing is saved', async () => {
    delete process.env.R2_BUCKET;
    const { response } = await putImage(alice);
    expect(response.status).toBe(503);
    const own = await data(await handlers.ownList(request('GET', '/api/me/profile-images', { cookie: await login(alice) })));
    expect(own.images).toEqual([]);
  });

  test('a failed upload to R2 leaves no row behind', async () => {
    useObjectClient({ send: async () => Promise.reject(new Error('boom')) } as unknown as S3Client);
    const { response } = await putImage(alice);
    expect(response.status).toBeGreaterThanOrEqual(500);
    const own = await data(await handlers.ownList(request('GET', '/api/me/profile-images', { cookie: await login(alice) })));
    expect(own.images).toEqual([]);
  });
});

describe('what the owner sees', () => {
  test('their own images with status and reason, even while pending or refused', async () => {
    const { cookie } = await putImage(alice);
    const own = await data(await handlers.ownList(request('GET', '/api/me/profile-images', { cookie })));
    expect(own.images).toHaveLength(1);
    expect(own.images[0]).toMatchObject({ kind: 'avatar', status: 'pending', rejectReason: null });
    expect(own.images[0].url).toContain('/pf/avatar/');
  });

  test('requires a login', async () => {
    expect((await handlers.ownList(request('GET', '/api/me/profile-images'))).status).toBe(401);
  });

  test('can remove their image, which also removes the file', async () => {
    const { cookie } = await putImage(alice);
    const key = [...stored.keys()][0];
    const response = await handlers.remove(request('DELETE', '/api/me/profile-images/avatar', { cookie }), kindCtx('avatar'));
    expect(response.status).toBe(200);
    expect(deleted).toContain(key);
    expect((await handlers.remove(request('DELETE', '/api/me/profile-images/avatar', { cookie }), kindCtx('avatar'))).status).toBe(404);
  });
});

describe('the public profile', () => {
  const publicProfile = async (playerId: string) => handlers.publicProfile(request('GET', `/api/profiles/${playerId}`), playerCtx(playerId));

  test('shows nothing for a pending image, and says so with a cacheable empty answer', async () => {
    await putImage(alice);
    const response = await publicProfile(alice.guid);
    expect(response.status).toBe(200);
    expect(await data(response)).toEqual({});
    expect(response.headers.get('cache-control')).toContain('s-maxage');
  });

  test('shows the approved image URLs and nothing else about the account', async () => {
    await putImage(alice, 'avatar');
    await putImage(alice, 'cover');
    expect((await approve(root, alice.guid, 'avatar')).status).toBe(200);
    const body = await data(await publicProfile(alice.guid));
    expect(Object.keys(body)).toEqual(['avatar']);
    expect(Object.keys(body.avatar).sort()).toEqual(['height', 'url', 'width']);
    expect(body.avatar.url).toContain('https://fbstorage.vxh.pl/pf/avatar/');
    expect(JSON.stringify(body)).not.toMatch(/alice|guid|status|report/i);
  });

  test('needs no login and has a public cache header', async () => {
    const response = await publicProfile('someone-new-1234');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toMatch(/public/);
  });

  test('400 for an id that is not a player id', async () => {
    for (const bad of ['..%2Fetc', 'a b', "x'--", 'a'.repeat(80)]) {
      expect((await publicProfile(bad)).status, bad).toBe(400);
    }
  });
});

describe('reports', () => {
  const report = (cookie: string | undefined, playerId: string, body: unknown, origin: string | null = ORIGIN) =>
    handlers.report(request('POST', `/api/profiles/${playerId}/report`, { cookie, body, origin }), playerCtx(playerId));

  beforeEach(async () => {
    await putImage(alice, 'avatar');
    await approve(root, alice.guid, 'avatar');
  });

  test('a logged-in player reports once', async () => {
    const cookie = await login(bob);
    expect((await report(cookie, alice.guid, { kind: 'avatar', reason: 'not appropriate' })).status).toBe(201);
    expect((await report(cookie, alice.guid, { kind: 'avatar' })).status).toBe(409);
  });

  test('needs a login and a same-origin request', async () => {
    expect((await report(undefined, alice.guid, { kind: 'avatar' })).status).toBe(401);
    expect((await report(await login(bob), alice.guid, { kind: 'avatar' }, 'https://evil.example')).status).toBe(403);
  });

  test('the owner cannot report themselves', async () => {
    expect((await report(await login(alice), alice.guid, { kind: 'avatar' })).status).toBe(400);
  });

  test('bad input is refused: unknown kind, bad player id', async () => {
    const cookie = await login(bob);
    expect((await report(cookie, alice.guid, { kind: 'banner' })).status).toBe(400);
    expect((await report(cookie, "x'--", { kind: 'avatar' })).status).toBe(400);
  });

  test('nothing to report: 404', async () => {
    expect((await report(await login(bob), 'guid-nobody', { kind: 'avatar' })).status).toBe(404);
  });

  test('the third different report hides the image from the public profile', async () => {
    for (const reporter of [bob, carol, dave]) await report(await login(reporter), alice.guid, { kind: 'avatar' });
    const body = await data(await handlers.publicProfile(request('GET', `/api/profiles/${alice.guid}`), playerCtx(alice.guid)));
    expect(body).toEqual({});
  });

  test('never tells who reported', async () => {
    const response = await report(await login(bob), alice.guid, { kind: 'avatar', reason: 'x' });
    expect(JSON.stringify(await data(response))).not.toMatch(/bob/);
  });
});

describe('moderation', () => {
  test('only an admin can list or decide', async () => {
    const { cookie } = await putImage(alice);
    expect((await handlers.adminList(request('GET', '/api/admin/profile-images', { cookie }))).status).toBe(403);
    expect((await handlers.adminList(request('GET', '/api/admin/profile-images'))).status).toBe(401);
    const adminCookie = await login(root);
    const [row] = (await data(await handlers.adminList(request('GET', '/api/admin/profile-images?status=pending', { cookie: adminCookie })))).images;
    expect((await handlers.adminReview(request('POST', `/api/admin/profile-images/${row.id}`, { cookie, body: { action: 'approve' } }), idCtx(row.id))).status).toBe(403);
  });

  test('the queue shows who uploaded what, with a picture address and report count', async () => {
    await putImage(alice);
    const list = await data(await handlers.adminList(request('GET', '/api/admin/profile-images?status=pending', { cookie: await login(root) })));
    expect(list.images[0]).toMatchObject({ nickname: 'alice', kind: 'avatar', status: 'pending', reports: 0 });
    expect(list.images[0].url).toContain('/pf/avatar/');
  });

  test('reject keeps it private and stores the reason for the owner', async () => {
    const { cookie } = await putImage(alice);
    const adminCookie = await login(root);
    const [row] = (await data(await handlers.adminList(request('GET', '/api/admin/profile-images?status=pending', { cookie: adminCookie })))).images;
    const response = await handlers.adminReview(request('POST', `/api/admin/profile-images/${row.id}`, { cookie: adminCookie, body: { action: 'reject', reason: 'Not a photo of you' } }), idCtx(row.id));
    expect(response.status).toBe(200);
    const own = await data(await handlers.ownList(request('GET', '/api/me/profile-images', { cookie })));
    expect(own.images[0]).toMatchObject({ status: 'rejected', rejectReason: 'Not a photo of you' });
    expect(await data(await handlers.publicProfile(request('GET', `/api/profiles/${alice.guid}`), playerCtx(alice.guid)))).toEqual({});
  });

  test('remove deletes the row and the file', async () => {
    await putImage(alice);
    const key = [...stored.keys()][0];
    const adminCookie = await login(root);
    const [row] = (await data(await handlers.adminList(request('GET', '/api/admin/profile-images?status=all', { cookie: adminCookie })))).images;
    const response = await handlers.adminReview(request('POST', `/api/admin/profile-images/${row.id}`, { cookie: adminCookie, body: { action: 'remove' } }), idCtx(row.id));
    expect(response.status).toBe(200);
    expect(deleted).toContain(key);
  });

  test('bad actions and unknown ids are refused', async () => {
    const adminCookie = await login(root);
    expect((await handlers.adminReview(request('POST', '/api/admin/profile-images/00000000-0000-4000-8000-000000000000', { cookie: adminCookie, body: { action: 'approve' } }), idCtx('00000000-0000-4000-8000-000000000000'))).status).toBe(404);
    expect((await handlers.adminReview(request('POST', '/api/admin/profile-images/x', { cookie: adminCookie, body: { action: 'delete-everything' } }), idCtx('x'))).status).toBe(400);
    expect((await handlers.adminList(request('GET', '/api/admin/profile-images?status=weird', { cookie: adminCookie }))).status).toBe(400);
  });
});
