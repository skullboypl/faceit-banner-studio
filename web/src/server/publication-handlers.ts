import { createContentGate } from './content-gate';
import { fail, guard, isFail, json, readBody, tooManyRequests, type Fail } from './http';
import { createLimits } from './limits';
import type { ModerationKind } from './moderation';
import {
  DuplicatePublicationError,
  InvalidPublicationError,
  PUBLICATION_STATUSES,
  adminList,
  listCatalog,
  listMine,
  publishBanner,
  setPublicationStatus,
  setVote,
  withdrawPublication,
  type Publication,
  type PublicationStatus,
} from './repo-publications';
import type { SessionUser } from './repo-users';
import { getSessionUser } from './session';

type Ctx = { params: Promise<{ id: string }> };

const guestView = (item: Publication) => ({
  id: item.id,
  bannerId: item.bannerId,
  title: item.title,
  body: item.body,
  status: item.status,
  votes: item.votes,
  vote: 0 as const,
  settings: item.settings,
  schemaVersion: item.schemaVersion,
  createdAt: item.createdAt,
  author: item.authorNickname,
});

const memberView = (item: Publication, user: SessionUser) => ({
  ...guestView(item),
  mine: item.authorGuid === user.guid,
  vote: item.vote,
});

export function createPublicationHandlers(options: { unlimited?: boolean } = {}) {
  const limits = createLimits(options.unlimited);
  const gate = createContentGate();
  const member = (request: Request, extra: Parameters<typeof guard>[1] = {}) =>
    guard(request, { unauthorizedCode: 'login_required', ip: limits.ip, ...extra });

  const run = async (work: () => Promise<Response>): Promise<Response> => {
    try {
      return await work();
    } catch (error) {
      if (error instanceof DuplicatePublicationError) {
        return fail(409, 'duplicate_publication', error.message).response;
      }
      if (error instanceof InvalidPublicationError) return fail(400, 'invalid_publication', error.message).response;
      if ((error as { code?: string }).code === 'not_found' || (error as Error).message === 'not_found') {
        return fail(404, 'not_found', 'Banner not found.').response;
      }
      if ((error as Error).message === 'database_unavailable') {
        return fail(503, 'database_unavailable', 'Storage is temporarily unavailable.').response;
      }
      return fail(500, 'server_error', 'Something went wrong.').response;
    }
  };

  const parseList = (request: Request): { sort: 'top' | 'new'; cursor?: string } | Fail => {
    const params = new URL(request.url).searchParams;
    const sort = params.get('sort') ?? 'top';
    if (sort !== 'top' && sort !== 'new') return fail(400, 'invalid_sort', 'sort must be top or new.');
    return { sort, cursor: params.get('cursor') ?? undefined };
  };

  return {
    listCatalog: (request: Request) =>
      run(async () => {
        if (!limits.ip(request, false)) return tooManyRequests('60');
        const query = parseList(request);
        if (isFail(query)) return query.response;
        const user = await getSessionUser(request);
        const page = await listCatalog({ ...query, viewerGuid: user?.guid ?? null });
        return json(200, {
          publications: page.publications.map((item) => (user ? memberView(item, user) : guestView(item))),
          next: page.next,
        });
      }),

    listMine: (request: Request) =>
      run(async () => {
        const user = await member(request);
        if (isFail(user)) return user.response;
        const publications = await listMine(user.guid);
        return json(200, { publications: publications.map((item) => memberView(item, user)) });
      }),

    publish: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await member(request, { write: true, limiter: limits.post, retryAfter: '30' });
        if (isFail(user)) return user.response;
        const body = await readBody(request);
        if (isFail(body)) return body.response;
        const fields: { text: string; kind: ModerationKind }[] = [];
        if (typeof body.title === 'string') fields.push({ text: body.title, kind: 'title' });
        if (typeof body.body === 'string') fields.push({ text: body.body, kind: 'body' });
        const blocked = gate.screen(user.guid, fields);
        if (blocked) return blocked;
        if (typeof body.title !== 'string' || typeof body.body !== 'string') {
          return fail(400, 'invalid_publication', 'title and description are required.').response;
        }
        const created = await publishBanner(user.guid, (await ctx.params).id, body.title, body.body);
        return json(201, { publication: memberView(created, user) });
      }),

    vote: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await member(request, { write: true, limiter: limits.vote, retryAfter: '5' });
        if (isFail(user)) return user.response;
        const body = await readBody(request);
        if (isFail(body)) return body.response;
        const value = body.value;
        if (value !== 1 && value !== -1) return fail(400, 'invalid_vote', 'value must be 1 or -1.').response;
        const result = await setVote(user.guid, (await ctx.params).id, value);
        return result ? json(200, result) : fail(404, 'not_found', 'Publication not found.').response;
      }),

    withdraw: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await member(request, { write: true });
        if (isFail(user)) return user.response;
        const outcome = await withdrawPublication(user.guid, (await ctx.params).id);
        return outcome === 'ok'
          ? json(200, { ok: true })
          : fail(404, 'not_found', 'Publication not found.').response;
      }),

    adminList: (request: Request) =>
      run(async () => {
        const user = await member(request, { admin: true, limiter: limits.admin });
        if (isFail(user)) return user.response;
        const params = new URL(request.url).searchParams;
        const status = params.get('status') ?? 'pending';
        if (status && !PUBLICATION_STATUSES.includes(status as PublicationStatus)) {
          return fail(400, 'invalid_status', 'Unknown status.').response;
        }
        const page = await adminList({
          status: (status || undefined) as PublicationStatus | undefined,
          cursor: params.get('cursor') ?? undefined,
        });
        return json(200, {
          publications: page.publications.map((item) => memberView(item, user)),
          next: page.next,
        });
      }),

    adminSetStatus: (request: Request, ctx: Ctx) =>
      run(async () => {
        const user = await member(request, { write: true, admin: true, limiter: limits.admin });
        if (isFail(user)) return user.response;
        const body = await readBody(request);
        if (isFail(body)) return body.response;
        if (body.status !== 'approved' && body.status !== 'declined') {
          return fail(400, 'invalid_status', 'status must be approved or declined.').response;
        }
        const updated = await setPublicationStatus((await ctx.params).id, body.status);
        return updated
          ? json(200, { publication: memberView(updated, user) })
          : fail(404, 'not_found', 'Publication not found.').response;
      }),
  };
}
