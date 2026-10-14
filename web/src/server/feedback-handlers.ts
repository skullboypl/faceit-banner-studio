import schemaJson from '../../../shared/settings-schema.json';
import { validateDelta, type SettingsSchema } from '../../../shared/settings-delta.mjs';
import { fail, guard, isAdmin, isFail, json, readBody, tooManyRequests, type Fail } from './http';
import { createLimits } from './limits';
import {
  InvalidPostError,
  POST_KINDS,
  POST_STATUSES,
  addComment,
  createPost,
  deleteComment,
  deletePost,
  exportPost,
  getPost,
  listPosts,
  setStatus,
  toggleVote,
  type CommentRow,
  type PostDetail,
  type PostKind,
  type PostStatus,
  type PostSummary,
} from './repo-posts';
import type { SessionUser } from './repo-users';
import { getSessionUser } from './session';

const schema = schemaJson as SettingsSchema;

type Ctx = { params: Promise<{ id: string }> };

const guestView = (post: PostSummary) => ({
  id: post.id,
  kind: post.kind,
  title: post.title,
  status: post.status,
  votes: post.votes,
  comments: post.comments,
  createdAt: post.createdAt,
});

const memberView = (post: PostSummary, user: SessionUser) => ({
  ...guestView(post),
  author: post.authorNickname,
  mine: post.authorGuid === user.guid,
  voted: post.voted,
});

const commentView = (comment: CommentRow, user: SessionUser) => ({
  id: comment.id,
  body: comment.body,
  byAdmin: comment.byAdmin,
  createdAt: comment.createdAt,
  author: comment.authorNickname,
  mine: comment.authorGuid === user.guid,
});

const detailView = (post: PostDetail, user: SessionUser) => ({
  ...memberView(post, user),
  body: post.body,
  context: post.context,
  thread: post.thread.map((comment) => commentView(comment, user)),
});

const shortText = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : undefined);

/** Keeps only the context keys the app sends itself; anything else a client adds is dropped. */
function cleanContext(raw: unknown): Record<string, unknown> | null | Fail {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return fail(400, 'invalid_context', 'context must be an object.');
  const input = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, max] of [['userAgent', 300], ['appVersion', 30], ['url', 300]] as const) {
    const value = shortText(input[key], max);
    if (value !== undefined) out[key] = value;
  }
  if (input.settings !== undefined) {
    const result = validateDelta(input.settings, schema);
    if (!result.ok) return fail(400, 'invalid_settings', result.errors.join('; '), { errors: result.errors });
    out.settings = input.settings;
  }
  return Object.keys(out).length ? out : null;
}

export function createFeedbackHandlers(options: { unlimited?: boolean } = {}) {
  const limits = createLimits(options.unlimited);

  const member = (request: Request, extra: Parameters<typeof guard>[1] = {}) =>
    guard(request, { unauthorizedCode: 'login_required', ip: limits.ip, ...extra });

  const run = async (work: () => Promise<Response>): Promise<Response> => {
    try {
      return await work();
    } catch (error) {
      if (error instanceof InvalidPostError) return fail(400, 'invalid_post', error.message).response;
      if ((error as Error).message === 'database_unavailable') {
        return fail(503, 'database_unavailable', 'Storage is temporarily unavailable.').response;
      }
      return fail(500, 'server_error', 'Something went wrong.').response;
    }
  };

  const notFound = () => fail(404, 'not_found', 'Post not found.').response;

  const parseQuery = (request: Request) => {
    const params = new URL(request.url).searchParams;
    const kind = params.get('kind') ?? undefined;
    const status = params.get('status') ?? undefined;
    const sort = params.get('sort') ?? 'top';
    if (kind && !POST_KINDS.includes(kind as PostKind)) return fail(400, 'invalid_kind', 'Unknown kind.');
    if (status && !POST_STATUSES.includes(status as PostStatus)) return fail(400, 'invalid_status', 'Unknown status.');
    if (sort !== 'top' && sort !== 'new') return fail(400, 'invalid_sort', 'sort must be top or new.');
    return {
      kind: kind as PostKind | undefined,
      status: status as PostStatus | undefined,
      sort: sort as 'top' | 'new',
      cursor: params.get('cursor') ?? undefined,
    };
  };

  return {
    listPosts: (request: Request) =>
      run(async () => {
        if (!limits.ip(request, false)) return tooManyRequests('60');
        const query = parseQuery(request);
        if (isFail(query)) return query.response;
        const user = await getSessionUser(request);
        const page = await listPosts({ ...query, viewerGuid: user?.guid ?? null });
        return json(200, {
          posts: page.posts.map((post) => (user ? memberView(post, user) : guestView(post))),
          next: page.next,
        });
      }),

    createPost: (request: Request) =>
      run(async () => {
        const user = await member(request, { write: true, limiter: limits.post, retryAfter: '600' });
        if (isFail(user)) return user.response;
        const body = await readBody(request);
        if (isFail(body)) return body.response;
        if (typeof body.kind !== 'string' || !POST_KINDS.includes(body.kind as PostKind)) {
          return fail(400, 'invalid_kind', 'kind must be request or bug.').response;
        }
        const context = body.kind === 'bug' ? cleanContext(body.context) : null;
        if (isFail(context)) return context.response;
        const created = await createPost(user.guid, {
          kind: body.kind as PostKind,
          title: body.title as string,
          body: body.body as string,
          context,
        });
        return json(201, { post: memberView(created, user) });
      }),

    getPost: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await member(request);
        if (isFail(user)) return user.response;
        const post = await getPost((await ctx.params).id, user.guid);
        return post ? json(200, { post: detailView(post, user) }) : notFound();
      }),

    deletePost: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await member(request, { write: true });
        if (isFail(user)) return user.response;
        const outcome = await deletePost((await ctx.params).id, { guid: user.guid, admin: isAdmin(user) });
        if (outcome === 'not_found') return notFound();
        if (outcome === 'forbidden') return fail(403, 'forbidden', 'You cannot delete this post.').response;
        return json(200, { ok: true });
      }),

    vote: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await member(request, { write: true, limiter: limits.vote, retryAfter: '5' });
        if (isFail(user)) return user.response;
        const result = await toggleVote(user.guid, (await ctx.params).id);
        return result ? json(200, result) : notFound();
      }),

    addComment: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await member(request, { write: true, limiter: limits.comment, retryAfter: '30' });
        if (isFail(user)) return user.response;
        const body = await readBody(request);
        if (isFail(body)) return body.response;
        const comment = await addComment(user.guid, (await ctx.params).id, body.body as string, isAdmin(user));
        return comment ? json(201, { comment: commentView(comment, user) }) : notFound();
      }),

    adminList: (request: Request) =>
      run(async () => {
        const user = await member(request, { admin: true, limiter: limits.admin });
        if (isFail(user)) return user.response;
        const query = parseQuery(request);
        if (isFail(query)) return query.response;
        const page = await listPosts({
          ...query,
          status: query.status ?? 'new',
          sort: new URL(request.url).searchParams.get('sort') ? query.sort : 'new',
          viewerGuid: user.guid,
        });
        return json(200, { posts: page.posts.map((post) => memberView(post, user)), next: page.next });
      }),

    adminSetStatus: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await member(request, { write: true, admin: true, limiter: limits.admin });
        if (isFail(user)) return user.response;
        const body = await readBody(request);
        if (isFail(body)) return body.response;
        if (typeof body.status !== 'string' || !POST_STATUSES.includes(body.status as PostStatus)) {
          return fail(400, 'invalid_status', 'Unknown status.').response;
        }
        const post = await setStatus((await ctx.params).id, body.status as PostStatus);
        return post ? json(200, { post: memberView(post, user) }) : notFound();
      }),

    adminDeletePost: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await member(request, { write: true, admin: true, limiter: limits.admin });
        if (isFail(user)) return user.response;
        const outcome = await deletePost((await ctx.params).id, { guid: user.guid, admin: true });
        return outcome === 'deleted' ? json(200, { ok: true }) : notFound();
      }),

    adminDeleteComment: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await member(request, { write: true, admin: true, limiter: limits.admin });
        if (isFail(user)) return user.response;
        return (await deleteComment((await ctx.params).id)) ? json(200, { ok: true }) : notFound();
      }),

    adminExport: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await member(request, { admin: true, limiter: limits.admin });
        if (isFail(user)) return user.response;
        const text = await exportPost((await ctx.params).id);
        return text === null
          ? notFound()
          : new Response(text, {
              status: 200,
              headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' },
            });
      }),
  };
}
