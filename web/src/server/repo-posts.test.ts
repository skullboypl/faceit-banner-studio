import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { TEST_DATABASE_URL } from './test-env';

process.env.DATABASE_URL = TEST_DATABASE_URL;

type Db = typeof import('./db');
type Posts = typeof import('./repo-posts');
type Users = typeof import('./repo-users');

let db: Db, posts: Posts, users: Users;
const alice = { guid: 'guid-alice', nickname: 'alice', avatar: null };
const bob = { guid: 'guid-bob', nickname: 'bob', avatar: null };
const root = { guid: 'guid-root', nickname: 'root', avatar: null };

const request = (title = 'Dark theme', body = 'Please add a darker theme.') => ({ kind: 'request' as const, title, body });

beforeAll(async () => {
  db = await import('./db');
  posts = await import('./repo-posts');
  users = await import('./repo-users');
  await db.migrate((await db.getPool())!);
});

beforeEach(async () => {
  await (await db.getPool())!.query('TRUNCATE comments, post_votes, posts, saved_banners, user_workspace, users CASCADE');
  for (const user of [alice, bob, root]) await users.upsertUser(user);
});

afterAll(async () => {
  await (await db.getPool())?.end();
});

describe('createPost and listPosts', () => {
  test('quotes and statement breaks are stored as text and the tables stay', async () => {
    const title = "'; DROP TABLE posts; --";
    const created = await posts.createPost(alice.guid, request(title, '1; SELECT * FROM users'));
    const { posts: list } = await posts.listPosts({ sort: 'new' });
    expect(list.map((post) => post.title)).toContain(title);
    const loaded = await posts.getPost(created.id, alice.guid);
    expect(loaded?.body).toBe('1; SELECT * FROM users');
    await expect(posts.listPosts({ sort: 'new', cursor: "'; DROP TABLE posts; --" })).rejects.toBeInstanceOf(
      posts.InvalidPostError
    );
    await expect(posts.listPosts({ sort: 'new', kind: "request' OR '1'='1" as never })).rejects.toBeInstanceOf(
      posts.InvalidPostError
    );
    const { rows } = await (await db.getPool())!.query<{ name: string }>("SELECT to_regclass('public.posts') AS name");
    expect(rows[0].name).toBe('posts');
  });

  test('creates a request and lists it newest first', async () => {
    await posts.createPost(alice.guid, request('First'));
    await posts.createPost(bob.guid, request('Second'));
    const { posts: list } = await posts.listPosts({ sort: 'new' });
    expect(list.map((post) => post.title)).toEqual(['Second', 'First']);
    expect(list[0]).toMatchObject({ kind: 'request', status: 'new', votes: 0, comments: 0, authorNickname: 'bob' });
  });

  test('rejects a title shorter than 3 or longer than 120 characters', async () => {
    for (const title of ['ab', '', 'x'.repeat(121)]) {
      await expect(posts.createPost(alice.guid, request(title))).rejects.toBeInstanceOf(posts.InvalidPostError);
    }
    await expect(posts.createPost(alice.guid, request('x'.repeat(120)))).resolves.toBeDefined();
  });

  test('rejects an empty body and a body over 4000 characters', async () => {
    for (const body of ['', '   ', 'x'.repeat(4001)]) {
      await expect(posts.createPost(alice.guid, request('Valid title', body))).rejects.toBeInstanceOf(
        posts.InvalidPostError
      );
    }
  });

  test('a bug stores its context and rejects a context over 16384 bytes', async () => {
    const bug = await posts.createPost(alice.guid, {
      kind: 'bug',
      title: 'Banner is cut off',
      body: 'Left edge is clipped.',
      context: { userAgent: 'test', appVersion: '3.6.0' },
    });
    expect((await posts.getPost(bug.id, alice.guid))!.context).toEqual({ userAgent: 'test', appVersion: '3.6.0' });
    await expect(
      posts.createPost(alice.guid, { kind: 'bug', title: 'Too much', body: 'x', context: { blob: 'a'.repeat(17000) } })
    ).rejects.toBeInstanceOf(posts.InvalidPostError);
  });

  test('a request ignores any context it was given', async () => {
    const created = await posts.createPost(alice.guid, { ...request(), context: { secret: 'x' } });
    expect((await posts.getPost(created.id, alice.guid))!.context).toBeNull();
  });

  test('rejects an unknown kind', async () => {
    await expect(
      posts.createPost(alice.guid, { kind: 'idea' as never, title: 'Valid title', body: 'body' })
    ).rejects.toBeInstanceOf(posts.InvalidPostError);
  });

  test('filters by kind and status', async () => {
    const a = await posts.createPost(alice.guid, request('A request'));
    await posts.createPost(alice.guid, { kind: 'bug', title: 'A bug', body: 'broken' });
    await posts.setStatus(a.id, 'planned');
    expect((await posts.listPosts({ sort: 'new', kind: 'bug' })).posts.map((p) => p.title)).toEqual(['A bug']);
    expect((await posts.listPosts({ sort: 'new', status: 'planned' })).posts.map((p) => p.title)).toEqual(['A request']);
  });

  test('top sort orders by votes then newest', async () => {
    const low = await posts.createPost(alice.guid, request('Low'));
    const high = await posts.createPost(alice.guid, request('High'));
    await posts.toggleVote(bob.guid, high.id);
    await posts.toggleVote(alice.guid, high.id);
    await posts.toggleVote(bob.guid, low.id);
    const { posts: list } = await posts.listPosts({ sort: 'top' });
    expect(list.map((p) => p.title)).toEqual(['High', 'Low']);
  });

  test('cursor paging walks every post once, for both sorts', async () => {
    for (let i = 0; i < 45; i++) {
      const created = await posts.createPost(alice.guid, request(`Post ${i}`));
      if (i % 3 === 0) await posts.toggleVote(bob.guid, created.id);
    }
    for (const sort of ['new', 'top'] as const) {
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await posts.listPosts({ sort, cursor });
        seen.push(...page.posts.map((p) => p.id));
        cursor = page.next ?? undefined;
      } while (cursor);
      expect(seen).toHaveLength(45);
      expect(new Set(seen).size).toBe(45);
    }
  });

  test('marks which posts the viewer voted for', async () => {
    const created = await posts.createPost(alice.guid, request());
    await posts.toggleVote(bob.guid, created.id);
    expect((await posts.listPosts({ sort: 'new', viewerGuid: bob.guid })).posts[0].voted).toBe(true);
    expect((await posts.listPosts({ sort: 'new', viewerGuid: alice.guid })).posts[0].voted).toBe(false);
  });
});

describe('votes', () => {
  test('toggleVote adds then removes a vote and keeps the counter exact', async () => {
    const created = await posts.createPost(alice.guid, request());
    expect(await posts.toggleVote(bob.guid, created.id)).toEqual({ voted: true, votes: 1 });
    expect(await posts.toggleVote(alice.guid, created.id)).toEqual({ voted: true, votes: 2 });
    expect(await posts.toggleVote(bob.guid, created.id)).toEqual({ voted: false, votes: 1 });
  });

  test('parallel votes by one user never double count', async () => {
    const created = await posts.createPost(alice.guid, request());
    await Promise.all(Array.from({ length: 20 }, () => posts.toggleVote(bob.guid, created.id)));
    const pool = (await db.getPool())!;
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM post_votes WHERE post_id = $1', [created.id]);
    const post = await posts.getPost(created.id, bob.guid);
    expect(rows[0].n).toBeLessThanOrEqual(1);
    expect(post!.votes).toBe(rows[0].n);
  });

  test('voting on an unknown or deleted post returns null', async () => {
    expect(await posts.toggleVote(bob.guid, '00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await posts.toggleVote(bob.guid, 'nope')).toBeNull();
    const created = await posts.createPost(alice.guid, request());
    await posts.deletePost(created.id, { guid: root.guid, admin: true });
    expect(await posts.toggleVote(bob.guid, created.id)).toBeNull();
  });
});

describe('comments', () => {
  test('addComment bumps the counter and flags admin comments', async () => {
    const created = await posts.createPost(alice.guid, request());
    await posts.addComment(bob.guid, created.id, 'Me too', false);
    const reply = await posts.addComment(root.guid, created.id, 'Planned', true);
    expect(reply).toMatchObject({ byAdmin: true, body: 'Planned', authorNickname: 'root' });
    const detail = await posts.getPost(created.id, alice.guid);
    expect(detail!.comments).toBe(2);
    expect(detail!.thread.map((c) => c.body)).toEqual(['Me too', 'Planned']);
  });

  test('rejects an empty comment and one over 2000 characters', async () => {
    const created = await posts.createPost(alice.guid, request());
    for (const body of ['', '  ', 'x'.repeat(2001)]) {
      await expect(posts.addComment(bob.guid, created.id, body, false)).rejects.toBeInstanceOf(posts.InvalidPostError);
    }
  });

  test('deleting a comment lowers the counter and hides it', async () => {
    const created = await posts.createPost(alice.guid, request());
    const comment = (await posts.addComment(bob.guid, created.id, 'spam', false))!;
    expect(await posts.deleteComment(comment.id)).toBe(true);
    expect(await posts.deleteComment(comment.id)).toBe(false);
    const detail = await posts.getPost(created.id, alice.guid);
    expect(detail!.comments).toBe(0);
    expect(detail!.thread).toEqual([]);
  });

  test('commenting on an unknown post returns null', async () => {
    expect(await posts.addComment(bob.guid, '00000000-0000-4000-8000-000000000000', 'hi', false)).toBeNull();
  });
});

describe('status and deletion', () => {
  test('setStatus changes only the status', async () => {
    const created = await posts.createPost(alice.guid, request('Keep me'));
    const updated = await posts.setStatus(created.id, 'in_progress');
    expect(updated).toMatchObject({ status: 'in_progress', title: 'Keep me' });
    expect(await posts.setStatus(created.id, 'weird' as never)).toBeNull();
  });

  test('the author can delete a post without foreign comments, others cannot, admins always can', async () => {
    const own = await posts.createPost(alice.guid, request('Own'));
    expect(await posts.deletePost(own.id, { guid: bob.guid, admin: false })).toBe('forbidden');
    expect(await posts.deletePost(own.id, { guid: alice.guid, admin: false })).toBe('deleted');

    const discussed = await posts.createPost(alice.guid, request('Discussed'));
    await posts.addComment(bob.guid, discussed.id, 'I disagree', false);
    expect(await posts.deletePost(discussed.id, { guid: alice.guid, admin: false })).toBe('forbidden');
    expect(await posts.deletePost(discussed.id, { guid: root.guid, admin: true })).toBe('deleted');
  });

  test('deleted posts disappear from lists and details', async () => {
    const created = await posts.createPost(alice.guid, request());
    await posts.deletePost(created.id, { guid: root.guid, admin: true });
    expect((await posts.listPosts({ sort: 'new' })).posts).toEqual([]);
    expect(await posts.getPost(created.id, alice.guid)).toBeNull();
    expect(await posts.deletePost(created.id, { guid: root.guid, admin: true })).toBe('not_found');
  });

  test('unknown or non-uuid ids are not found', async () => {
    expect(await posts.getPost('nope', alice.guid)).toBeNull();
    expect(await posts.setStatus('nope', 'done')).toBeNull();
    expect(await posts.deletePost('nope', { guid: root.guid, admin: true })).toBe('not_found');
    expect(await posts.exportPost('nope')).toBeNull();
  });
});

describe('exportPost', () => {
  test('renders markdown with the context and the comments in order', async () => {
    const bug = await posts.createPost(alice.guid, {
      kind: 'bug',
      title: 'Level icon is clipped',
      body: 'Glow is cut on the left.',
      context: { userAgent: 'Chrome/130', appVersion: '3.6.0' },
    });
    await posts.toggleVote(bob.guid, bug.id);
    await posts.addComment(bob.guid, bug.id, 'Same on my side', false);
    await posts.addComment(root.guid, bug.id, 'Looking into it', true);
    const text = (await posts.exportPost(bug.id))!;
    expect(text).toContain('# Level icon is clipped');
    expect(text).toMatch(/bug/i);
    expect(text).toContain('alice');
    expect(text).toContain('Glow is cut on the left.');
    expect(text).toContain('Chrome/130');
    expect(text.indexOf('Same on my side')).toBeLessThan(text.indexOf('Looking into it'));
    expect(text).toMatch(/votes?: 1/i);
  });
});
