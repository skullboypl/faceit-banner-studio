import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { TEST_DATABASE_URL } from './test-env';

process.env.DATABASE_URL = TEST_DATABASE_URL;

type Db = typeof import('./db');
type Banners = typeof import('./repo-banners');
type Workspace = typeof import('./repo-workspace');
type Users = typeof import('./repo-users');

let db: Db, banners: Banners, workspace: Workspace, users: Users;
const alice = { guid: 'guid-alice', nickname: 'alice', avatar: null };
const bob = { guid: 'guid-bob', nickname: 'bob', avatar: null };

beforeAll(async () => {
  db = await import('./db');
  banners = await import('./repo-banners');
  workspace = await import('./repo-workspace');
  users = await import('./repo-users');
  await db.migrate((await db.getPool())!);
});

beforeEach(async () => {
  const pool = (await db.getPool())!;
  await pool.query('TRUNCATE saved_banners, user_workspace, users CASCADE');
  await users.upsertUser(alice);
  await users.upsertUser(bob);
});

afterAll(async () => {
  await (await db.getPool())?.end();
});

describe('banners', () => {
  test('a name that looks like SQL is stored as a name', async () => {
    const name = "Robert'); DROP TABLE saved_banners;--";
    await banners.createBanner(alice.guid, name, {});
    expect((await banners.listBanners(alice.guid)).map((banner) => banner.name)).toContain(name);
    const { rows } = await (await db.getPool())!.query<{ name: string }>(
      "SELECT to_regclass('public.saved_banners') AS name"
    );
    expect(rows[0].name).toBe('saved_banners');
  });

  test('creates and lists banners newest first', async () => {
    await banners.createBanner(alice.guid, 'first', { bannerRadius: 10 });
    await banners.createBanner(alice.guid, 'second', {});
    const list = await banners.listBanners(alice.guid);
    expect(list.map((banner) => banner.name)).toEqual(['second', 'first']);
    expect(list[1].settings).toEqual({ bannerRadius: 10 });
    expect(list[0].visibility).toBe('private');
  });

  test('rejects the 26th banner', async () => {
    for (let i = 0; i < 25; i++) await banners.createBanner(alice.guid, `banner ${i}`, {});
    await expect(banners.createBanner(alice.guid, 'one too many', {})).rejects.toBeInstanceOf(
      banners.BannerLimitError
    );
  });

  test('rejects duplicate name ignoring case, but another user may reuse it', async () => {
    await banners.createBanner(alice.guid, 'Main', {});
    await expect(banners.createBanner(alice.guid, 'main', {})).rejects.toBeInstanceOf(
      banners.DuplicateNameError
    );
    await expect(banners.createBanner(bob.guid, 'main', {})).resolves.toBeDefined();
  });

  test('accepts emoji and counts characters, not bytes', async () => {
    const created = await banners.createBanner(alice.guid, '🔥 Główny', {});
    expect(created.name).toBe('🔥 Główny');
    await expect(banners.createBanner(alice.guid, '🔥'.repeat(60), {})).resolves.toBeDefined();
  });

  test('rejects a name longer than 60 characters', async () => {
    await expect(banners.createBanner(alice.guid, 'a'.repeat(61), {})).rejects.toBeInstanceOf(
      banners.InvalidNameError
    );
  });

  test('rejects empty, whitespace-only and control-character names', async () => {
    for (const name of ['', '   ', 'bad\u0000name', 'tab\tname']) {
      await expect(banners.createBanner(alice.guid, name, {})).rejects.toBeInstanceOf(
        banners.InvalidNameError
      );
    }
  });

  test("a user cannot read, update or delete another user's banner", async () => {
    const created = await banners.createBanner(alice.guid, 'mine', {});
    expect(await banners.listBanners(bob.guid)).toEqual([]);
    expect(await banners.updateBanner(bob.guid, created.id, { name: 'stolen' })).toBeNull();
    expect(await banners.deleteBanner(bob.guid, created.id)).toBe(false);
    expect((await banners.listBanners(alice.guid))[0].name).toBe('mine');
  });

  test('update renames and overwrites settings; delete removes', async () => {
    const created = await banners.createBanner(alice.guid, 'old', { bannerRadius: 5 });
    const updated = await banners.updateBanner(alice.guid, created.id, {
      name: 'new',
      settings: { bannerRadius: 9 },
    });
    expect(updated).toMatchObject({ name: 'new', settings: { bannerRadius: 9 } });
    expect(await banners.deleteBanner(alice.guid, created.id)).toBe(true);
    expect(await banners.listBanners(alice.guid)).toEqual([]);
  });

  test('renaming to another banner name is a duplicate', async () => {
    await banners.createBanner(alice.guid, 'a', {});
    const b = await banners.createBanner(alice.guid, 'b', {});
    await expect(banners.updateBanner(alice.guid, b.id, { name: 'A' })).rejects.toBeInstanceOf(
      banners.DuplicateNameError
    );
  });

  test('an id that is not a uuid is treated as not found', async () => {
    expect(await banners.updateBanner(alice.guid, 'nope', { name: 'x' })).toBeNull();
    expect(await banners.deleteBanner(alice.guid, 'nope')).toBe(false);
  });
});

describe('workspace', () => {
  test('round-trip', async () => {
    expect(await workspace.loadWorkspace(alice.guid)).toBeNull();
    await workspace.saveWorkspace(alice.guid, { settings: { bannerRadius: 3 }, version: 1, deviceId: 'd1' });
    expect(await workspace.loadWorkspace(alice.guid)).toMatchObject({
      settings: { bannerRadius: 3 },
      version: 1,
      deviceId: 'd1',
    });
  });

  test('an older version never overwrites a newer one', async () => {
    await workspace.saveWorkspace(alice.guid, { settings: { a: 2 }, version: 2, deviceId: 'd1' });
    await workspace.saveWorkspace(alice.guid, { settings: { a: 1 }, version: 1, deviceId: 'd2' });
    expect((await workspace.loadWorkspace(alice.guid))!.version).toBe(2);
  });
});

describe('migrate', () => {
  test('can run twice', async () => {
    const pool = (await db.getPool())!;
    await expect(db.migrate(pool)).resolves.toBeUndefined();
    await expect(db.migrate(pool)).resolves.toBeUndefined();
  });
});
