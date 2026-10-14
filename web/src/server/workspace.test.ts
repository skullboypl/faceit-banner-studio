import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { TEST_DATABASE_URL, TEST_REDIS_URL } from './test-env';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.REDIS_URL = TEST_REDIS_URL;

type Workspace = typeof import('./workspace');
type Redis = typeof import('./redis');

let ws: Workspace, redis: Redis, db: typeof import('./db'), users: typeof import('./repo-users'), repo: typeof import('./repo-workspace');
const alice = { guid: 'guid-alice', nickname: 'alice', avatar: null };

beforeAll(async () => {
  db = await import('./db');
  redis = await import('./redis');
  users = await import('./repo-users');
  repo = await import('./repo-workspace');
  ws = await import('./workspace');
  await db.migrate((await db.getPool())!);
});

beforeEach(async () => {
  process.env.REDIS_URL = TEST_REDIS_URL;
  await (await redis.getRedis())!.flushdb();
  await (await db.getPool())!.query('TRUNCATE user_workspace, users CASCADE');
  await users.upsertUser(alice);
});

afterAll(async () => {
  process.env.REDIS_URL = TEST_REDIS_URL;
  await (await redis.getRedis())?.quit();
  await (await db.getPool())?.end();
});

const put = (deviceId: string, baseVersion: number, settings: Record<string, unknown> = { bannerRadius: 1 }) =>
  ws.putWorkspace(alice.guid, { settings, deviceId, baseVersion });

describe('putWorkspace', () => {
  test('increments the version on every write', async () => {
    expect(await put('d1', 0)).toEqual({ status: 'ok', version: 1 });
    expect(await put('d1', 1)).toEqual({ status: 'ok', version: 2 });
  });

  test('the same device always wins, even with a stale base', async () => {
    await put('d1', 0);
    await put('d1', 1);
    expect(await put('d1', 0)).toEqual({ status: 'ok', version: 3 });
  });

  test('a stale base from another device returns a conflict with the current state', async () => {
    await put('d1', 0, { bannerRadius: 7 });
    const result = await put('d2', 0, { bannerRadius: 9 });
    expect(result).toEqual({
      status: 'conflict',
      current: { settings: { bannerRadius: 7 }, version: 1, deviceId: 'd1' },
    });
  });

  test('another device with an up-to-date base is accepted', async () => {
    await put('d1', 0);
    expect(await put('d2', 1)).toEqual({ status: 'ok', version: 2 });
  });

  test('parallel writes from one device get distinct versions', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => put('d1', 0)));
    const versions = results.map((result) => (result.status === 'ok' ? result.version : -1));
    expect(new Set(versions).size).toBe(20);
    expect(Math.max(...versions)).toBe(20);
  });
});

describe('getWorkspace', () => {
  test('returns null for a new user', async () => {
    expect(await ws.getWorkspace(alice.guid)).toBeNull();
  });

  test('falls back to postgres when the redis key is gone, and keeps versions monotonic', async () => {
    await put('d1', 0);
    await ws.flushNow();
    await (await redis.getRedis())!.flushdb();
    expect(await ws.getWorkspace(alice.guid)).toMatchObject({ version: 1, deviceId: 'd1' });
    expect(await put('d1', 1)).toEqual({ status: 'ok', version: 2 });
  });
});

describe('flush', () => {
  test('writes dirty users to postgres and clears the dirty set', async () => {
    await put('d1', 0, { bannerRadius: 12 });
    expect(await repo.loadWorkspace(alice.guid)).toBeNull();
    await ws.flushNow();
    expect(await repo.loadWorkspace(alice.guid)).toMatchObject({ settings: { bannerRadius: 12 }, version: 1 });
    expect(await (await redis.getRedis())!.scard('fb:workspace:dirty')).toBe(0);
  });

  test('puts the user back in the dirty set when postgres fails', async () => {
    const client = (await redis.getRedis())!;
    await client.hset('fb:workspace:ghost-user', { settings: '{}', version: '1', device: 'd1' });
    await client.sadd('fb:workspace:dirty', 'ghost-user');
    await ws.flushNow();
    expect(await client.sismember('fb:workspace:dirty', 'ghost-user')).toBe(1);
  });

  test('startFlushWorker flushes on its own and stops cleanly', async () => {
    const worker = ws.startFlushWorker(50);
    await put('d1', 0);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await worker.stop();
    expect(await repo.loadWorkspace(alice.guid)).toMatchObject({ version: 1 });
  });
});

describe('redis unavailable', () => {
  test('put and get fall back to postgres directly', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:1';
    expect(await put('d1', 0, { bannerRadius: 4 })).toEqual({ status: 'ok', version: 1 });
    expect(await put('d2', 0)).toMatchObject({ status: 'conflict' });
    expect(await ws.getWorkspace(alice.guid)).toMatchObject({ settings: { bannerRadius: 4 }, version: 1 });
    expect(await repo.loadWorkspace(alice.guid)).toMatchObject({ version: 1 });
  });
});
