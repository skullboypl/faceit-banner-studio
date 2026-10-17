import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { TEST_DATABASE_URL, TEST_REDIS_URL } from './test-env';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.REDIS_URL = TEST_REDIS_URL;
process.env.PUBLIC_URL = 'http://localhost:5173';
process.env.ADMIN_FACEIT_GUIDS = 'guid-admin';

type Handlers = ReturnType<typeof import('./publication-handlers').createPublicationHandlers>;
let handlers: Handlers;
let redis: typeof import('./redis');
let db: typeof import('./db');
let users: typeof import('./repo-users');
let banners: typeof import('./repo-banners');

const ORIGIN = 'http://localhost:5173';
const alice = { guid: 'guid-alice', nickname: 'alice', avatar: null };
const admin = { guid: 'guid-admin', nickname: 'admin', avatar: null };

async function login(user: { guid: string; nickname: string; avatar: null }) {
  const id = randomBytes(24).toString('hex');
  await (await redis.getRedis())!.set(`fb:session:${id}`, JSON.stringify(user), 'EX', 600);
  return `fb_session=${id}`;
}

const call = (method: string, path: string, { cookie, body }: { cookie?: string; body?: unknown } = {}) =>
  new Request(`http://localhost:3100${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      origin: ORIGIN,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const withId = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  redis = await import('./redis');
  db = await import('./db');
  users = await import('./repo-users');
  banners = await import('./repo-banners');
  const { createPublicationHandlers } = await import('./publication-handlers');
  handlers = createPublicationHandlers({ unlimited: true });
});

beforeEach(async () => {
  await (await redis.getRedis())!.flushdb();
  await (await db.getPool())!.query('TRUNCATE saved_banners, user_workspace, users CASCADE');
  await users.upsertUser(alice);
  await users.upsertUser(admin);
});

afterAll(async () => {
  await (await redis.getRedis())?.quit();
  await (await db.getPool())?.end();
});

describe('publication handlers', () => {
  test('a player submits a banner and an admin publishes it to the catalog', async () => {
    const cookie = await login(alice);
    const banner = await banners.createBanner(alice.guid, 'Pulse look', { style: 'pulse' });
    const created = await handlers.publish(
      call('POST', `/api/me/banners/${banner.id}/publish`, {
        cookie,
        body: { title: 'Night pulse', body: 'A round banner for the cam overlay.' },
      }),
      withId(banner.id)
    );
    expect(created.status).toBe(201);
    const payload = (await created.json()) as { publication: { id: string; status: string } };
    expect(payload.publication.status).toBe('pending');

    const empty = await handlers.listCatalog(call('GET', '/api/catalog/banners'));
    expect(((await empty.json()) as { publications: unknown[] }).publications).toHaveLength(0);

    const adminCookie = await login(admin);
    const approved = await handlers.adminSetStatus(
      call('PATCH', `/api/admin/publications/${payload.publication.id}`, {
        cookie: adminCookie,
        body: { status: 'approved' },
      }),
      withId(payload.publication.id)
    );
    expect(approved.status).toBe(200);

    const live = await handlers.listCatalog(call('GET', '/api/catalog/banners'));
    const catalog = (await live.json()) as { publications: { title: string }[] };
    expect(catalog.publications.map((item) => item.title)).toEqual(['Night pulse']);
  });
});
