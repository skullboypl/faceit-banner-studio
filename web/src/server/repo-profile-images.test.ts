import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { TEST_DATABASE_URL } from './test-env';

process.env.DATABASE_URL = TEST_DATABASE_URL;

type Db = typeof import('./db');
type Repo = typeof import('./repo-profile-images');
type Users = typeof import('./repo-users');

let db: Db, repo: Repo, users: Users;
const alice = { guid: 'guid-alice', nickname: 'alice', avatar: null };
const bob = { guid: 'guid-bob', nickname: 'bob', avatar: null };
const carol = { guid: 'guid-carol', nickname: 'carol', avatar: null };
const dave = { guid: 'guid-dave', nickname: 'dave', avatar: null };
const root = { guid: 'guid-root', nickname: 'root', avatar: null };

const upload = (ownerGuid: string, kind: 'avatar' | 'cover', key: string, approved = false) =>
  repo.saveProfileImage({ ownerGuid, kind, key, width: 512, height: 512, bytes: 1000, approved });

beforeAll(async () => {
  db = await import('./db');
  repo = await import('./repo-profile-images');
  users = await import('./repo-users');
  await db.migrate((await db.getPool())!);
});

beforeEach(async () => {
  const pool = (await db.getPool())!;
  await pool.query('TRUNCATE profile_image_reports, profile_images, users CASCADE');
  for (const user of [alice, bob, carol, dave, root]) await users.upsertUser(user);
});

afterAll(async () => {
  await (await db.getPool())?.end();
});

describe('saving', () => {
  test('a new image waits for review and is not public', async () => {
    const saved = await upload(alice.guid, 'avatar', 'pf/avatar/a1.webp');
    expect(saved.image.status).toBe('pending');
    expect(saved.replacedKey).toBeNull();
    expect(await repo.listApprovedProfileImages(alice.guid)).toEqual([]);
    const own = await repo.listOwnProfileImages(alice.guid);
    expect(own.map((image) => [image.kind, image.status, image.key])).toEqual([['avatar', 'pending', 'pf/avatar/a1.webp']]);
  });

  test('an approved upload (an admin\'s own) is public at once', async () => {
    await upload(root.guid, 'cover', 'pf/cover/r1.webp', true);
    expect((await repo.listApprovedProfileImages(root.guid)).map((image) => image.kind)).toEqual(['cover']);
  });

  test('one image per kind: a second upload replaces the first and returns the old file to delete', async () => {
    await upload(alice.guid, 'avatar', 'pf/avatar/old.webp');
    const second = await upload(alice.guid, 'avatar', 'pf/avatar/new.webp');
    expect(second.replacedKey).toBe('pf/avatar/old.webp');
    const own = await repo.listOwnProfileImages(alice.guid);
    expect(own).toHaveLength(1);
    expect(own[0].key).toBe('pf/avatar/new.webp');
  });

  test('a replaced image is reviewed again, and its reports start from zero', async () => {
    await upload(alice.guid, 'avatar', 'pf/avatar/old.webp', true);
    await repo.reportProfileImage({ ownerGuid: alice.guid, kind: 'avatar', reporterGuid: bob.guid, reason: 'x' });
    const second = await upload(alice.guid, 'avatar', 'pf/avatar/new.webp');
    expect(second.image.status).toBe('pending');
    expect(await repo.listApprovedProfileImages(alice.guid)).toEqual([]);
    const { rows } = await (await db.getPool())!.query('SELECT 1 FROM profile_image_reports');
    expect(rows).toHaveLength(0);
  });

  test('avatar and cover are independent', async () => {
    await upload(alice.guid, 'avatar', 'pf/avatar/a.webp');
    await upload(alice.guid, 'cover', 'pf/cover/c.webp');
    expect((await repo.listOwnProfileImages(alice.guid)).map((image) => image.kind).sort()).toEqual(['avatar', 'cover']);
  });
});

describe('visibility', () => {
  test('only approved images are public, and only the owner sees the others', async () => {
    await upload(alice.guid, 'avatar', 'pf/avatar/a.webp');
    await upload(alice.guid, 'cover', 'pf/cover/c.webp');
    const approved = (await repo.listForReview('pending', 10)).find((row) => row.kind === 'cover')!;
    await repo.reviewProfileImage(approved.id, 'approve', root.guid);
    expect((await repo.listApprovedProfileImages(alice.guid)).map((image) => image.kind)).toEqual(['cover']);
    expect(await repo.listApprovedProfileImages(bob.guid)).toEqual([]);
  });
});

describe('own removal', () => {
  test('returns the file to delete and leaves nothing behind', async () => {
    await upload(alice.guid, 'avatar', 'pf/avatar/a.webp', true);
    expect(await repo.deleteProfileImage(alice.guid, 'avatar')).toBe('pf/avatar/a.webp');
    expect(await repo.listOwnProfileImages(alice.guid)).toEqual([]);
    expect(await repo.deleteProfileImage(alice.guid, 'avatar')).toBeNull();
  });

  test('cannot remove somebody else\'s image', async () => {
    await upload(alice.guid, 'avatar', 'pf/avatar/a.webp', true);
    expect(await repo.deleteProfileImage(bob.guid, 'avatar')).toBeNull();
    expect(await repo.listOwnProfileImages(alice.guid)).toHaveLength(1);
  });
});

describe('reports', () => {
  beforeEach(async () => {
    await upload(alice.guid, 'avatar', 'pf/avatar/a.webp', true);
  });

  test('an approved image of someone else can be reported once per person', async () => {
    expect(await repo.reportProfileImage({ ownerGuid: alice.guid, kind: 'avatar', reporterGuid: bob.guid, reason: 'rude' })).toBe('reported');
    expect(await repo.reportProfileImage({ ownerGuid: alice.guid, kind: 'avatar', reporterGuid: bob.guid, reason: 'again' })).toBe('duplicate');
  });

  test('the owner cannot report their own image, and a missing or unapproved image cannot be reported', async () => {
    expect(await repo.reportProfileImage({ ownerGuid: alice.guid, kind: 'avatar', reporterGuid: alice.guid, reason: '' })).toBe('own');
    expect(await repo.reportProfileImage({ ownerGuid: alice.guid, kind: 'cover', reporterGuid: bob.guid, reason: '' })).toBe('not_found');
    await upload(bob.guid, 'avatar', 'pf/avatar/b.webp');
    expect(await repo.reportProfileImage({ ownerGuid: bob.guid, kind: 'avatar', reporterGuid: carol.guid, reason: '' })).toBe('not_found');
  });

  test('three different people hide the image until an admin decides', async () => {
    for (const reporter of [bob, carol]) await repo.reportProfileImage({ ownerGuid: alice.guid, kind: 'avatar', reporterGuid: reporter.guid, reason: '' });
    expect((await repo.listApprovedProfileImages(alice.guid)).length).toBe(1);
    expect(await repo.reportProfileImage({ ownerGuid: alice.guid, kind: 'avatar', reporterGuid: dave.guid, reason: '' })).toBe('hidden');
    expect(await repo.listApprovedProfileImages(alice.guid)).toEqual([]);
    expect((await repo.listOwnProfileImages(alice.guid))[0].status).toBe('hidden');
  });

  test('reasons are trimmed and capped', async () => {
    await repo.reportProfileImage({ ownerGuid: alice.guid, kind: 'avatar', reporterGuid: bob.guid, reason: 'x'.repeat(900) });
    const { rows } = await (await db.getPool())!.query<{ reason: string }>('SELECT reason FROM profile_image_reports');
    expect(rows[0].reason.length).toBeLessThanOrEqual(300);
  });

  test('a report shows up on the review list with its count', async () => {
    await repo.reportProfileImage({ ownerGuid: alice.guid, kind: 'avatar', reporterGuid: bob.guid, reason: '' });
    const reported = await repo.listForReview('reported', 10);
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({ ownerGuid: alice.guid, nickname: 'alice', reports: 1, status: 'approved' });
  });
});

describe('review', () => {
  test('approving makes it public and clears the reports', async () => {
    await upload(alice.guid, 'avatar', 'pf/avatar/a.webp');
    const [row] = await repo.listForReview('pending', 10);
    const result = await repo.reviewProfileImage(row.id, 'approve', root.guid);
    expect(result).toMatchObject({ ok: true, key: null });
    expect((await repo.listApprovedProfileImages(alice.guid))[0].key).toBe('pf/avatar/a.webp');
  });

  test('rejecting keeps the file out of public view and tells the owner why', async () => {
    await upload(alice.guid, 'avatar', 'pf/avatar/a.webp');
    const [row] = await repo.listForReview('pending', 10);
    await repo.reviewProfileImage(row.id, 'reject', root.guid, 'Not a photo of you');
    expect(await repo.listApprovedProfileImages(alice.guid)).toEqual([]);
    expect(await repo.listOwnProfileImages(alice.guid)).toMatchObject([{ status: 'rejected', rejectReason: 'Not a photo of you' }]);
  });

  test('removing deletes the row and hands back the file to delete', async () => {
    await upload(alice.guid, 'avatar', 'pf/avatar/a.webp', true);
    const [row] = await repo.listForReview('all', 10);
    expect(await repo.reviewProfileImage(row.id, 'remove', root.guid)).toMatchObject({ ok: true, key: 'pf/avatar/a.webp' });
    expect(await repo.listOwnProfileImages(alice.guid)).toEqual([]);
  });

  test('an unknown id is reported as missing', async () => {
    expect(await repo.reviewProfileImage('00000000-0000-4000-8000-000000000000', 'approve', root.guid)).toEqual({ ok: false });
  });

  test('the pending queue is oldest first and the list is capped', async () => {
    await upload(alice.guid, 'avatar', 'pf/avatar/a.webp');
    await new Promise((resolve) => setTimeout(resolve, 15));
    await upload(bob.guid, 'avatar', 'pf/avatar/b.webp');
    expect((await repo.listForReview('pending', 10)).map((row) => row.nickname)).toEqual(['alice', 'bob']);
    expect(await repo.listForReview('pending', 1)).toHaveLength(1);
  });

  test('statuses filter the list', async () => {
    await upload(alice.guid, 'avatar', 'pf/avatar/a.webp', true);
    await upload(bob.guid, 'avatar', 'pf/avatar/b.webp');
    expect(await repo.listForReview('pending', 10)).toHaveLength(1);
    expect(await repo.listForReview('all', 10)).toHaveLength(2);
  });
});
