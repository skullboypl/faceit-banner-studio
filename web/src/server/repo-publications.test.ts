import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { TEST_DATABASE_URL } from './test-env';

process.env.DATABASE_URL = TEST_DATABASE_URL;

type Db = typeof import('./db');
type Banners = typeof import('./repo-banners');
type Users = typeof import('./repo-users');
type Publications = typeof import('./repo-publications');

let db: Db, banners: Banners, users: Users, publications: Publications;
const alice = { guid: 'guid-alice', nickname: 'alice', avatar: null };
const bob = { guid: 'guid-bob', nickname: 'bob', avatar: null };

beforeAll(async () => {
  db = await import('./db');
  banners = await import('./repo-banners');
  users = await import('./repo-users');
  publications = await import('./repo-publications');
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

describe('banner publications', () => {
  test('a submit waits for review and is hidden from the public list until approved', async () => {
    const banner = await banners.createBanner(alice.guid, 'Pulse look', { style: 'pulse' });
    const submitted = await publications.publishBanner(
      alice.guid,
      banner.id,
      'Night pulse',
      'A round banner for the cam overlay.'
    );
    expect(submitted.status).toBe('pending');
    expect(submitted.authorNickname).toBe('alice');
    const publicList = await publications.listCatalog({ sort: 'new', viewerGuid: null });
    expect(publicList.publications).toHaveLength(0);
    const mine = await publications.listMine(alice.guid);
    expect(mine.map((entry) => entry.status)).toEqual(['pending']);
    await publications.setPublicationStatus(submitted.id, 'approved');
    const live = await publications.listCatalog({ sort: 'new', viewerGuid: bob.guid });
    expect(live.publications).toHaveLength(1);
    expect(live.publications[0].title).toBe('Night pulse');
    expect(live.publications[0].body).toContain('cam overlay');
  });

  test('reddit-style votes add, switch and undo', async () => {
    const banner = await banners.createBanner(alice.guid, 'Halo', { style: 'halo' });
    const submitted = await publications.publishBanner(alice.guid, banner.id, 'Wide halo', 'Slim bar for the HUD.');
    await publications.setPublicationStatus(submitted.id, 'approved');
    const up = await publications.setVote(bob.guid, submitted.id, 1);
    expect(up).toEqual({ votes: 1, vote: 1 });
    const down = await publications.setVote(bob.guid, submitted.id, -1);
    expect(down).toEqual({ votes: -1, vote: -1 });
    const undo = await publications.setVote(bob.guid, submitted.id, -1);
    expect(undo).toEqual({ votes: 0, vote: 0 });
  });

  test('cannot publish the same live banner twice', async () => {
    const banner = await banners.createBanner(alice.guid, 'Prime', { style: 'prime' });
    await publications.publishBanner(alice.guid, banner.id, 'Prime night', 'Classic overlay with four stats.');
    await expect(
      publications.publishBanner(alice.guid, banner.id, 'Prime again', 'Another description here.')
    ).rejects.toBeInstanceOf(publications.DuplicatePublicationError);
  });
});
