import { randomBytes } from 'node:crypto';
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { sweepAttachments } from './attachment-sweep';
import { TEST_DATABASE_URL, TEST_REDIS_URL } from './test-env';
import { useObjectClient } from './r2';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.REDIS_URL = TEST_REDIS_URL;
process.env.PUBLIC_URL = 'http://localhost:5173';
process.env.ADMIN_FACEIT_GUIDS = 'guid-root';

type Handlers = ReturnType<typeof import('./feedback-handlers').createFeedbackHandlers>;
let handlers: Handlers;
let redis: typeof import('./redis');
let db: typeof import('./db');

const ORIGIN = 'http://localhost:5173';
const alice = { guid: 'guid-alice', nickname: 'alice', avatar: null };
const bob = { guid: 'guid-bob', nickname: 'bob', avatar: null };
const root = { guid: 'guid-root', nickname: 'root', avatar: null };
const MISSING = '00000000-0000-4000-8000-000000000000';

async function login(user: typeof alice) {
  const id = randomBytes(24).toString('hex');
  await (await redis.getRedis())!.set(`fb:session:${id}`, JSON.stringify(user), 'EX', 600);
  return `fb_session=${id}`;
}

const call = (
  method: string,
  path: string,
  { cookie, body, origin = ORIGIN }: { cookie?: string; body?: unknown; origin?: string | null } = {}
) =>
  new Request(`http://localhost:3100${path}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}), 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

type Json = {
  error?: string;
  post?: { id?: string; title?: string; status?: string };
  posts?: { id?: string }[];
  comment?: { id?: string };
  [key: string]: unknown;
};
const json = async (response: Response) => response.json() as Promise<Json>;
const withId = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  redis = await import('./redis');
  db = await import('./db');
  const { createFeedbackHandlers } = await import('./feedback-handlers');
  handlers = createFeedbackHandlers({ unlimited: true });
});

beforeEach(async () => {
  await (await redis.getRedis())!.flushdb();
  await (await db.getPool())!.query('TRUNCATE comments, post_votes, posts, saved_banners, user_workspace, users CASCADE');
});

afterAll(async () => {
  await (await redis.getRedis())?.quit();
  await (await db.getPool())?.end();
});

async function create(cookie: string, body: Record<string, unknown> = {}) {
  const response = await handlers.createPost(
    call('POST', '/api/posts', { cookie, body: { kind: 'request', title: 'Dark theme', body: 'Please add one.', ...body } })
  );
  return { response, data: await json(response) };
}

describe('listing', () => {
  test('a guest list shows titles and counters but no author, body or voted flag', async () => {
    const cookie = await login(alice);
    await create(cookie, { title: 'Visible title' });
    const response = await handlers.listPosts(call('GET', '/api/posts?sort=new'));
    expect(response.status).toBe(200);
    const { posts } = await json(response);
    expect(posts).toHaveLength(1);
    expect(Object.keys(posts[0]).sort()).toEqual(['comments', 'createdAt', 'id', 'kind', 'status', 'title', 'votes']);
  });

  test('a logged-in list adds the author, mine and voted', async () => {
    const aliceCookie = await login(alice);
    const bobCookie = await login(bob);
    const { data } = await create(aliceCookie);
    await handlers.vote(call('POST', `/api/posts/${data.post.id}/vote`, { cookie: bobCookie }), withId(data.post.id));
    const { posts } = await json(await handlers.listPosts(call('GET', '/api/posts', { cookie: bobCookie })));
    expect(posts[0]).toMatchObject({ author: 'alice', mine: false, voted: true });
    const own = await json(await handlers.listPosts(call('GET', '/api/posts', { cookie: aliceCookie })));
    expect(own.posts[0]).toMatchObject({ mine: true, voted: false });
  });

  test('400 for an unknown kind, status, sort or a broken cursor', async () => {
    for (const query of ['kind=idea', 'status=maybe', 'sort=random', 'cursor=@@@']) {
      expect((await handlers.listPosts(call('GET', `/api/posts?${query}`))).status).toBe(400);
    }
  });

  test('filters by kind', async () => {
    const cookie = await login(alice);
    await create(cookie, { title: 'A request' });
    await create(cookie, { kind: 'bug', title: 'A bug' });
    const { posts } = await json(await handlers.listPosts(call('GET', '/api/posts?kind=bug')));
    expect(posts.map((post: { title: string }) => post.title)).toEqual(['A bug']);
  });
});

describe('per-IP limits', () => {
  const fromIp = (ip: string, cookie?: string) =>
    new Request('http://localhost:3100/api/posts', {
      headers: { 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}) },
    });

  test('a flood of reads from one IP is rejected with 429 and Retry-After', async () => {
    const { createFeedbackHandlers } = await import('./feedback-handlers');
    const limited = createFeedbackHandlers();
    let rejected = 0;
    let retryAfter: string | null = null;
    for (let i = 0; i < 160; i++) {
      const response = await limited.listPosts(fromIp('198.51.100.20'));
      if (response.status === 429) {
        rejected++;
        retryAfter = response.headers.get('retry-after');
      }
    }
    expect(rejected).toBeGreaterThanOrEqual(40);
    expect(retryAfter).not.toBeNull();
  });

  test('another IP is not blocked by the flood', async () => {
    const { createFeedbackHandlers } = await import('./feedback-handlers');
    const limited = createFeedbackHandlers();
    for (let i = 0; i < 160; i++) await limited.listPosts(fromIp('198.51.100.21'));
    expect((await limited.listPosts(fromIp('198.51.100.22'))).status).toBe(200);
  });

  test('writes are limited harder than reads: 21st write from one IP is rejected before login is even checked', async () => {
    const { createFeedbackHandlers } = await import('./feedback-handlers');
    const limited = createFeedbackHandlers();
    const write = () =>
      limited.vote(
        new Request(`http://localhost:3100/api/posts/${MISSING}/vote`, {
          method: 'POST',
          headers: { origin: ORIGIN, 'x-forwarded-for': '198.51.100.23' },
        }),
        withId(MISSING)
      );
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) statuses.push((await write()).status);
    expect(statuses.slice(0, 20).every((status) => status === 401)).toBe(true);
    expect(statuses.slice(20).every((status) => status === 429)).toBe(true);
  });
});

describe('creating', () => {
  test('requires a session and a same-origin Origin', async () => {
    const body = { kind: 'request', title: 'Dark theme', body: 'Please.' };
    expect((await handlers.createPost(call('POST', '/api/posts', { body }))).status).toBe(401);
    const cookie = await login(alice);
    for (const origin of ['https://evil.example', null]) {
      expect((await handlers.createPost(call('POST', '/api/posts', { cookie, body, origin }))).status).toBe(403);
    }
  });

  test('validates kind, title and body with 400', async () => {
    const cookie = await login(alice);
    expect((await create(cookie, { kind: 'idea' })).response.status).toBe(400);
    expect((await create(cookie, { title: 'ab' })).response.status).toBe(400);
    expect((await create(cookie, { body: '' })).response.status).toBe(400);
    expect((await create(cookie, { title: 'x'.repeat(121) })).response.status).toBe(400);
  });

  test('a bug keeps only the allowed context keys and validates the settings delta', async () => {
    const cookie = await login(alice);
    const { response, data } = await create(cookie, {
      kind: 'bug',
      title: 'Broken banner',
      context: { userAgent: 'Chrome', appVersion: '3.6.0', settings: { bannerRadius: 20 }, password: 'secret' },
    });
    expect(response.status).toBe(201);
    const detail = await json(await handlers.getPost(call('GET', `/api/posts/${data.post.id}`, { cookie }), withId(data.post.id)));
    expect(detail.post.context).toEqual({ userAgent: 'Chrome', appVersion: '3.6.0', settings: { bannerRadius: 20 } });

    const bad = await create(cookie, { kind: 'bug', title: 'Bad settings', context: { settings: { bannerRadius: 999 } } });
    expect(bad.response.status).toBe(400);
  });

  test('the 4th post within an hour returns 429 with the default limits', async () => {
    const { createFeedbackHandlers } = await import('./feedback-handlers');
    const limited = createFeedbackHandlers();
    const cookie = await login(alice);
    const post = (n: number) =>
      limited.createPost(
        call('POST', '/api/posts', { cookie, body: { kind: 'request', title: `Idea number ${n}`, body: `please ${n}` } })
      );
    for (let i = 0; i < 3; i++) expect((await post(i)).status).toBe(201);
    const fourth = await post(3);
    expect(fourth.status).toBe(429);
    expect(fourth.headers.get('retry-after')).not.toBeNull();
  });

  test('markup in a title comes back verbatim as text', async () => {
    const cookie = await login(alice);
    const { data } = await create(cookie, { title: '<script>alert(1)</script> hi' });
    expect(data.post.title).toBe('<script>alert(1)</script> hi');
  });
});

describe('details', () => {
  test('a guest gets 401 login_required', async () => {
    const cookie = await login(alice);
    const { data } = await create(cookie);
    const response = await handlers.getPost(call('GET', `/api/posts/${data.post.id}`), withId(data.post.id));
    expect(response.status).toBe(401);
    expect((await json(response)).error).toBe('login_required');
  });

  test('a logged-in user sees the body, author and comments with nicknames', async () => {
    const aliceCookie = await login(alice);
    const bobCookie = await login(bob);
    const { data } = await create(aliceCookie, { body: 'Full description.' });
    await handlers.addComment(
      call('POST', `/api/posts/${data.post.id}/comments`, { cookie: bobCookie, body: { body: 'Agreed' } }),
      withId(data.post.id)
    );
    const detail = await json(await handlers.getPost(call('GET', `/api/posts/${data.post.id}`, { cookie: bobCookie }), withId(data.post.id)));
    expect(detail.post).toMatchObject({ body: 'Full description.', author: 'alice', mine: false, comments: 1 });
    expect(detail.post.thread[0]).toMatchObject({ body: 'Agreed', author: 'bob', mine: true, byAdmin: false });
  });

  test('an unknown or malformed id is 404', async () => {
    const cookie = await login(alice);
    for (const id of [MISSING, 'nope']) {
      expect((await handlers.getPost(call('GET', `/api/posts/${id}`, { cookie }), withId(id))).status).toBe(404);
    }
  });
});

describe('votes and comments', () => {
  test('a guest cannot vote or comment', async () => {
    const { data } = await create(await login(alice));
    expect((await handlers.vote(call('POST', `/api/posts/${data.post.id}/vote`), withId(data.post.id))).status).toBe(401);
    expect(
      (await handlers.addComment(call('POST', `/api/posts/${data.post.id}/comments`, { body: { body: 'hi' } }), withId(data.post.id))).status
    ).toBe(401);
  });

  test('vote toggles and returns the counter', async () => {
    const { data } = await create(await login(alice));
    const cookie = await login(bob);
    const vote = () => handlers.vote(call('POST', `/api/posts/${data.post.id}/vote`, { cookie }), withId(data.post.id));
    expect(await json(await vote())).toEqual({ voted: true, votes: 1 });
    expect(await json(await vote())).toEqual({ voted: false, votes: 0 });
    expect((await handlers.vote(call('POST', `/api/posts/${MISSING}/vote`, { cookie }), withId(MISSING))).status).toBe(404);
  });

  test('a comment returns 201, bumps the counter and validates the body', async () => {
    const { data } = await create(await login(alice));
    const cookie = await login(bob);
    const comment = (body: unknown) =>
      handlers.addComment(call('POST', `/api/posts/${data.post.id}/comments`, { cookie, body: { body } }), withId(data.post.id));
    const ok = await comment('First!');
    expect(ok.status).toBe(201);
    expect((await json(ok)).comment).toMatchObject({ body: 'First!', author: 'bob', byAdmin: false });
    expect((await comment('')).status).toBe(400);
    expect((await comment('x'.repeat(2001))).status).toBe(400);
    const { posts } = await json(await handlers.listPosts(call('GET', '/api/posts')));
    expect(posts[0].comments).toBe(1);
  });

  test('the 7th comment within a minute returns 429', async () => {
    const { createFeedbackHandlers } = await import('./feedback-handlers');
    const limited = createFeedbackHandlers();
    const { data } = await create(await login(alice));
    const cookie = await login(bob);
    const comment = (n: number) =>
      limited.addComment(
        call('POST', `/api/posts/${data.post.id}/comments`, { cookie, body: { body: `hi ${n}` } }),
        withId(data.post.id)
      );
    for (let i = 0; i < 6; i++) expect((await comment(i)).status).toBe(201);
    expect((await comment(6)).status).toBe(429);
  });

  test('an admin comment is flagged byAdmin', async () => {
    const { data } = await create(await login(alice));
    const cookie = await login(root);
    const response = await handlers.addComment(
      call('POST', `/api/posts/${data.post.id}/comments`, { cookie, body: { body: 'We will do this' } }),
      withId(data.post.id)
    );
    expect((await json(response)).comment.byAdmin).toBe(true);
  });
});

describe('moderation', () => {
  const spammer = { guid: 'guid-spam', nickname: 'spammer', avatar: null };

  test('a profane title or body is 400 content_blocked and the matched word is not quoted', async () => {
    const { createFeedbackHandlers } = await import('./feedback-handlers');
    const gated = createFeedbackHandlers({ unlimited: true });
    const cookie = await login(spammer);
    const title = await gated.createPost(
      call('POST', '/api/posts', { cookie, body: { kind: 'request', title: 'to jest kurwa', body: 'A normal description.' } })
    );
    const titleBody = await json(title);
    expect(title.status).toBe(400);
    expect(titleBody).toMatchObject({ error: 'content_blocked', category: 'profanity' });
    expect(JSON.stringify(titleBody).toLowerCase()).not.toContain('kurwa');

    const body = await gated.createPost(
      call('POST', '/api/posts', { cookie, body: { kind: 'request', title: 'Dark theme', body: 'what the fuck is this' } })
    );
    const blockedBody = await json(body);
    expect(blockedBody).toMatchObject({ error: 'content_blocked', category: 'profanity' });
    expect(JSON.stringify(blockedBody).toLowerCase()).not.toContain('fuck');
    expect((await json(await gated.listPosts(call('GET', '/api/posts')))).posts).toEqual([]);
  });

  test('a profane comment is blocked the same way', async () => {
    const { createFeedbackHandlers } = await import('./feedback-handlers');
    const gated = createFeedbackHandlers({ unlimited: true });
    const cookie = await login(alice);
    const { data } = await create(cookie);
    const response = await gated.addComment(
      call('POST', `/api/posts/${data.post.id}/comments`, { cookie, body: { body: 'fuck this' } }),
      withId(data.post.id)
    );
    const payload = await json(response);
    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'content_blocked', category: 'profanity' });
    expect(JSON.stringify(payload).toLowerCase()).not.toContain('fuck');
  });

  test('a filled website field is rejected as spam and nothing is stored', async () => {
    const { createFeedbackHandlers } = await import('./feedback-handlers');
    const gated = createFeedbackHandlers({ unlimited: true });
    const cookie = await login(spammer);
    const response = await gated.createPost(
      call('POST', '/api/posts', {
        cookie,
        body: { kind: 'request', title: 'Legit title', body: 'Legit body here.', website: 'http://spam.example' },
      })
    );
    const payload = await json(response);
    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'content_blocked', category: 'spam' });
    expect(JSON.stringify(payload)).not.toContain('spam.example');
    expect((await json(await gated.listPosts(call('GET', '/api/posts')))).posts).toEqual([]);
  });

  test('the same author cannot post the same text twice, even with different spacing or case', async () => {
    const cookie = await login(alice);
    expect((await create(cookie, { title: 'Dark theme', body: 'Please add one.' })).response.status).toBe(201);
    const again = await create(cookie, { title: '  dark   theme ', body: 'PLEASE ADD ONE.' });
    expect(again.response.status).toBe(409);
    expect(again.data.error).toBe('duplicate_content');
    expect(JSON.stringify(again.data)).not.toContain('Dark theme');
    const bobCookie = await login(bob);
    expect((await create(bobCookie, { title: 'Dark theme', body: 'Please add one.' })).response.status).toBe(201);
  });

  test('the same comment twice on one post is a duplicate; another person may repeat it', async () => {
    const aliceCookie = await login(alice);
    const bobCookie = await login(bob);
    const { data } = await create(aliceCookie);
    const comment = (cookie: string) =>
      handlers.addComment(
        call('POST', `/api/posts/${data.post.id}/comments`, { cookie, body: { body: 'Same thought' } }),
        withId(data.post.id)
      );
    expect((await comment(aliceCookie)).status).toBe(201);
    const duplicate = await comment(aliceCookie);
    expect(duplicate.status).toBe(409);
    expect((await json(duplicate)).error).toBe('duplicate_content');
    expect((await comment(bobCookie)).status).toBe(201);
  });

  test('deleting the post frees the content hash', async () => {
    const cookie = await login(alice);
    const { data } = await create(cookie, { title: 'Once more', body: 'With feeling.' });
    expect((await handlers.deletePost(call('DELETE', `/api/posts/${data.post.id}`, { cookie }), withId(data.post.id))).status).toBe(200);
    expect((await create(cookie, { title: 'Once more', body: 'With feeling.' })).response.status).toBe(201);
  });

  test('five blocked posts lock the next write for an hour', async () => {
    const { createFeedbackHandlers } = await import('./feedback-handlers');
    const gated = createFeedbackHandlers({ unlimited: true });
    const cookie = await login(spammer);
    const post = (title: string) =>
      gated.createPost(call('POST', '/api/posts', { cookie, body: { kind: 'request', title, body: 'A normal description.' } }));
    for (let i = 0; i < 5; i++) expect((await post('kurwa title')).status).toBe(400);
    const locked = await post('A perfectly fine title');
    expect(locked.status).toBe(429);
    expect((await json(locked)).error).toBe('writing_locked');
    expect(Number(locked.headers.get('retry-after'))).toBeGreaterThan(3000);
  });
});

describe('deleting', () => {
  test("a normal user cannot delete someone else's post; the author can", async () => {
    const aliceCookie = await login(alice);
    const bobCookie = await login(bob);
    const { data } = await create(aliceCookie);
    const del = (cookie: string) => handlers.deletePost(call('DELETE', `/api/posts/${data.post.id}`, { cookie }), withId(data.post.id));
    expect((await del(bobCookie)).status).toBe(403);
    expect((await del(aliceCookie)).status).toBe(200);
    expect((await del(aliceCookie)).status).toBe(404);
  });
});

describe('admin', () => {
  test('status changes: guest 401, normal user 403, admin 200 and the list reflects it', async () => {
    const aliceCookie = await login(alice);
    const rootCookie = await login(root);
    const { data } = await create(aliceCookie);
    const setStatus = (cookie?: string, status = 'planned') =>
      handlers.adminSetStatus(
        call('PATCH', `/api/admin/posts/${data.post.id}`, { cookie, body: { status } }),
        withId(data.post.id)
      );
    expect((await setStatus()).status).toBe(401);
    expect((await setStatus(aliceCookie)).status).toBe(403);
    expect((await setStatus(rootCookie, 'weird')).status).toBe(400);
    expect((await setStatus(rootCookie)).status).toBe(200);
    const { posts } = await json(await handlers.listPosts(call('GET', '/api/posts?status=planned')));
    expect(posts).toHaveLength(1);
  });

  test('the author cannot change the status of their own post', async () => {
    const cookie = await login(alice);
    const { data } = await create(cookie);
    const response = await handlers.adminSetStatus(
      call('PATCH', `/api/admin/posts/${data.post.id}`, { cookie, body: { status: 'done' } }),
      withId(data.post.id)
    );
    expect(response.status).toBe(403);
  });

  test('the queue lists posts by status for admins only', async () => {
    const aliceCookie = await login(alice);
    const rootCookie = await login(root);
    await create(aliceCookie, { title: 'Needs triage' });
    expect((await handlers.adminList(call('GET', '/api/admin/posts', { cookie: aliceCookie }))).status).toBe(403);
    const { posts } = await json(await handlers.adminList(call('GET', '/api/admin/posts?status=new', { cookie: rootCookie })));
    expect(posts[0]).toMatchObject({ title: 'Needs triage', author: 'alice' });
  });

  test('export: guest 401, normal user 403, admin gets markdown', async () => {
    const aliceCookie = await login(alice);
    const rootCookie = await login(root);
    const { data } = await create(aliceCookie, { title: 'Exported title', body: 'Exported body.' });
    const exportOf = (cookie?: string) =>
      handlers.adminExport(call('GET', `/api/admin/posts/${data.post.id}/export`, { cookie }), withId(data.post.id));
    expect((await exportOf()).status).toBe(401);
    expect((await exportOf(aliceCookie)).status).toBe(403);
    const ok = await exportOf(rootCookie);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toContain('text/markdown');
    const text = await ok.text();
    expect(text).toContain('# Exported title');
    expect(text).toContain('Exported body.');
  });

  test('admin delete removes the post from the list; deleting a comment lowers the counter', async () => {
    const aliceCookie = await login(alice);
    const rootCookie = await login(root);
    const { data } = await create(aliceCookie);
    const commented = await json(
      await handlers.addComment(
        call('POST', `/api/posts/${data.post.id}/comments`, { cookie: aliceCookie, body: { body: 'spam' } }),
        withId(data.post.id)
      )
    );
    const delComment = await handlers.adminDeleteComment(
      call('DELETE', `/api/admin/comments/${commented.comment.id}`, { cookie: rootCookie }),
      withId(commented.comment.id)
    );
    expect(delComment.status).toBe(200);
    expect((await json(await handlers.listPosts(call('GET', '/api/posts')))).posts[0].comments).toBe(0);

    const delPost = await handlers.adminDeletePost(
      call('DELETE', `/api/admin/posts/${data.post.id}`, { cookie: rootCookie }),
      withId(data.post.id)
    );
    expect(delPost.status).toBe(200);
    expect((await json(await handlers.listPosts(call('GET', '/api/posts')))).posts).toEqual([]);
    expect(
      (await handlers.adminDeletePost(call('DELETE', `/api/admin/posts/${data.post.id}`, { cookie: rootCookie }), withId(data.post.id))).status
    ).toBe(404);
  });
});

describe('attachments', () => {
  const stored = new Map<string, Uint8Array>();
  const r2Names = ['R2_BUCKET', 'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL'] as const;

  beforeEach(() => {
    stored.clear();
    process.env.R2_BUCKET = 'banners-vxh';
    process.env.R2_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_PUBLIC_URL = 'https://fbstorage.vxh.pl';
    useObjectClient({
      send: async (command: { constructor: { name: string }; input: { Key?: string; Body?: Uint8Array } }) => {
        const key = command.input.Key ?? '';
        if (command.constructor.name === PutObjectCommand.name && command.input.Body) stored.set(key, command.input.Body);
        else stored.delete(key);
      },
    } as unknown as S3Client);
  });

  afterEach(() => {
    useObjectClient(null);
    for (const name of r2Names) delete process.env[name];
  });

  const upload = async (cookie: string, bytes: Buffer) => {
    const form = new FormData();
    form.set('file', new File([bytes], 'shot.bin', { type: 'application/octet-stream' }));
    return handlers.upload(
      new Request('http://127.0.0.1:3100/api/attachments', { method: 'POST', headers: { cookie, origin: ORIGIN }, body: form })
    );
  };

  test('rejects a GIF and a file over 1 MB, then stores a re-encoded WebP under a random key', async () => {
    const cookie = await login(alice);
    expect((await upload(cookie, Buffer.from('GIF89a not a screenshot'))).status).toBe(400);
    expect((await json(await upload(cookie, Buffer.alloc(1024 * 1024 + 1)))).error).toBe('too_big');
    const png = await sharp({ create: { width: 6, height: 4, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();
    const response = await upload(cookie, png);
    const saved = await json(response);
    expect(response.status).toBe(201);
    expect(saved.url).toMatch(/^https:\/\/fbstorage\.vxh\.pl\/att\/[a-f0-9]{32}\.webp$/);
    expect(stored.size).toBe(1);

    const created = await json(
      await handlers.createPost(
        call('POST', '/api/posts', {
          cookie,
          body: { kind: 'bug', title: 'Glow is cut', body: 'Left side.', attachmentIds: [saved.id] },
        })
      )
    );
    const loaded = await json(await handlers.getPost(call('GET', `/api/posts/${created.post?.id}`, { cookie }), withId(created.post?.id ?? '')));
    expect(loaded.post).toMatchObject({ attachments: [{ url: saved.url, width: 6, height: 4 }] });

    const guest = await json(await handlers.listPosts(call('GET', '/api/posts?sort=new')));
    expect(JSON.stringify(guest)).not.toContain('fbstorage');

    const queue = await json(await handlers.adminList(call('GET', '/api/admin/posts?status=new', { cookie: await login(root) })));
    expect(JSON.stringify(queue)).toContain(saved.url);

    const stolen = await handlers.createPost(
      call('POST', '/api/posts', {
        cookie: await login(bob),
        body: { kind: 'bug', title: 'Not mine', body: 'Trying.', attachmentIds: [saved.id] },
      })
    );
    expect((await json(stolen)).error).toBe('attachment_invalid');
  });

  test('an admin hide removes the object, and an upload left unused for a day is swept', async () => {
    const cookie = await login(alice);
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
    const saved = await json(await upload(cookie, png));
    const created = await json(
      await handlers.createPost(
        call('POST', '/api/posts', { cookie, body: { kind: 'bug', title: 'With shot', body: 'See image.', attachmentIds: [saved.id] } })
      )
    );
    const rootCookie = await login(root);
    const removed = await handlers.adminDeleteAttachment(
      call('DELETE', `/api/admin/attachments/${saved.id}`, { cookie: rootCookie }),
      withId(String(saved.id))
    );
    expect(removed.status).toBe(200);
    expect(stored.size).toBe(0);
    const loaded = await json(await handlers.getPost(call('GET', `/api/posts/${created.post?.id}`, { cookie }), withId(created.post?.id ?? '')));
    expect(loaded.post).toMatchObject({ attachments: [] });

    const orphan = await json(await upload(cookie, png));
    await (await db.getPool())!.query(`UPDATE attachments SET created_at = NOW() - INTERVAL '2 days' WHERE id = $1`, [orphan.id]);
    expect(await sweepAttachments(new Date(), { lock: false })).toBe(2);
    expect(stored.size).toBe(0);
    const left = await (await db.getPool())!.query('SELECT id FROM attachments WHERE id = $1', [orphan.id]);
    expect(left.rowCount).toBe(0);
  });
});
