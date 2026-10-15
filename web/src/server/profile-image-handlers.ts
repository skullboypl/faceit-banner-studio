import { fail, guard, isAdmin, isFail, json, readBody, tooManyRequests } from './http';
import { ImageReject, MAX_UPLOAD_BYTES } from './images';
import { createLimits } from './limits';
import { isPlayerId, isProfileKind, profileKey, toProfileWebp, type ProfileKind } from './profile-images';
import { deleteObject, isR2Configured, publicUrl, putObject } from './r2';
import {
  deleteProfileImage,
  listApprovedProfileImages,
  listForReview,
  listOwnProfileImages,
  reportProfileImage,
  reviewProfileImage,
  saveProfileImage,
  type ProfileImageRow,
  type ReviewFilter,
} from './repo-profile-images';

type KindCtx = { params: Promise<{ kind: string }> };
type IdCtx = { params: Promise<{ id: string }> };
type PlayerCtx = { params: Promise<{ playerId: string }> };

/** Cached at the edge: a profile changes rarely, and approving a new image may take a few minutes to show. */
const PUBLIC_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const FILTERS: ReviewFilter[] = ['pending', 'reported', 'hidden', 'all'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const urlOf = (key: string): string | null => {
  try {
    return publicUrl(key);
  } catch {
    return null;
  }
};

const ownView = (image: ProfileImageRow) => ({
  kind: image.kind,
  status: image.status,
  rejectReason: image.rejectReason,
  url: urlOf(image.key),
  width: image.width,
  height: image.height,
});

export function createProfileImageHandlers(options: { unlimited?: boolean } = {}) {
  const limits = createLimits(options.unlimited);

  const member = (request: Request, extra: Parameters<typeof guard>[1] = {}) =>
    guard(request, { unauthorizedCode: 'login_required', ip: limits.ip, ...extra });

  const run = async (work: () => Promise<Response>): Promise<Response> => {
    try {
      return await work();
    } catch (error) {
      if ((error as Error).message === 'database_unavailable') {
        return fail(503, 'database_unavailable', 'Storage is temporarily unavailable.').response;
      }
      return fail(500, 'server_error', 'Something went wrong.').response;
    }
  };

  const notFound = (what = 'Image') => fail(404, 'not_found', `${what} not found.`).response;
  const dropFile = (key: string | null) => (key ? deleteObject(key).catch(() => undefined) : Promise.resolve());

  return {
    /** Anyone: the approved avatar and cover of one player. Nothing else about the account. */
    publicProfile: (request: Request, ctx: PlayerCtx) =>
      run(async () => {
        if (!limits.ip(request, false)) return tooManyRequests('60');
        const { playerId } = await ctx.params;
        if (!isPlayerId(playerId)) return fail(400, 'invalid_player', 'Not a player id.').response;
        const body: Record<string, { url: string; width: number; height: number }> = {};
        for (const image of await listApprovedProfileImages(playerId)) {
          const url = urlOf(image.key);
          if (url) body[image.kind] = { url, width: image.width, height: image.height };
        }
        return json(200, body, { 'cache-control': PUBLIC_CACHE });
      }),

    ownList: (request: Request) =>
      run(async () => {
        const user = await member(request);
        if (isFail(user)) return user.response;
        return json(200, { images: (await listOwnProfileImages(user.guid)).map(ownView) });
      }),

    put: (request: Request, ctx: KindCtx) =>
      run(async () => {
        const { kind } = await ctx.params;
        if (!isProfileKind(kind)) return notFound('Kind');
        const user = await member(request, { write: true, limiter: limits.upload, retryAfter: '60' });
        if (isFail(user)) return user.response;
        const declared = Number(request.headers.get('content-length'));
        if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + 16_384) {
          return fail(413, 'too_big', 'Image is larger than 1 MB.').response;
        }
        if (!isR2Configured()) return fail(503, 'r2_not_configured', 'File storage is not configured.').response;
        const form = await request.formData().catch(() => null);
        const file = form?.get('file');
        if (!(file instanceof File)) return fail(400, 'bad_type', 'Choose one PNG, JPEG or WebP image.').response;
        if (file.size > MAX_UPLOAD_BYTES) return fail(413, 'too_big', 'Image is larger than 1 MB.').response;
        let image: { body: Buffer; width: number; height: number };
        try {
          image = await toProfileWebp(Buffer.from(await file.arrayBuffer()), kind as ProfileKind);
        } catch (error) {
          if (error instanceof ImageReject) {
            const tooBig = error.code === 'too_big';
            return fail(tooBig ? 413 : 400, error.code, tooBig ? 'Image is larger than 1 MB.' : 'Choose one PNG, JPEG or WebP image.').response;
          }
          throw error;
        }
        const key = profileKey(kind as ProfileKind);
        await putObject(key, image.body, 'image/webp');
        let saved: Awaited<ReturnType<typeof saveProfileImage>>;
        try {
          saved = await saveProfileImage({
            ownerGuid: user.guid,
            kind: kind as ProfileKind,
            key,
            width: image.width,
            height: image.height,
            bytes: image.body.length,
            approved: isAdmin(user),
          });
        } catch (error) {
          await dropFile(key);
          throw error;
        }
        await dropFile(saved.replacedKey);
        return json(201, { image: ownView(saved.image) });
      }),

    remove: (request: Request, ctx: KindCtx) =>
      run(async () => {
        const { kind } = await ctx.params;
        if (!isProfileKind(kind)) return notFound('Kind');
        const user = await member(request, { write: true });
        if (isFail(user)) return user.response;
        const key = await deleteProfileImage(user.guid, kind);
        if (!key) return notFound();
        await dropFile(key);
        return json(200, { ok: true });
      }),

    /** A logged-in player flags somebody else's approved image. The owner is never told who. */
    report: (request: Request, ctx: PlayerCtx) =>
      run(async () => {
        const user = await member(request, { write: true, limiter: limits.profileReport, retryAfter: '60' });
        if (isFail(user)) return user.response;
        const { playerId } = await ctx.params;
        if (!isPlayerId(playerId)) return fail(400, 'invalid_player', 'Not a player id.').response;
        const body = await readBody(request);
        if (isFail(body)) return body.response;
        if (!isProfileKind(body.kind)) return fail(400, 'invalid_kind', 'kind must be avatar or cover.').response;
        const outcome = await reportProfileImage({
          ownerGuid: playerId,
          kind: body.kind,
          reporterGuid: user.guid,
          reason: typeof body.reason === 'string' ? body.reason : '',
        });
        if (outcome === 'own') return fail(400, 'own_image', 'You cannot report your own image.').response;
        if (outcome === 'not_found') return notFound();
        if (outcome === 'duplicate') return fail(409, 'already_reported', 'You already reported this image.').response;
        return json(201, { ok: true });
      }),

    adminList: (request: Request) =>
      run(async () => {
        const user = await member(request, { admin: true, limiter: limits.admin });
        if (isFail(user)) return user.response;
        const status = new URL(request.url).searchParams.get('status') ?? 'pending';
        if (!FILTERS.includes(status as ReviewFilter)) return fail(400, 'invalid_status', 'Unknown status filter.').response;
        const rows = await listForReview(status as ReviewFilter, 100);
        return json(200, {
          images: rows.map((row) => ({ ...ownView(row), id: row.id, ownerGuid: row.ownerGuid, nickname: row.nickname, reports: row.reports, createdAt: row.createdAt })),
        });
      }),

    adminReview: (request: Request, ctx: IdCtx) =>
      run(async () => {
        const user = await member(request, { write: true, admin: true, limiter: limits.admin });
        if (isFail(user)) return user.response;
        const { id } = await ctx.params;
        const body = await readBody(request);
        if (isFail(body)) return body.response;
        const action = body.action;
        if (action !== 'approve' && action !== 'reject' && action !== 'remove') {
          return fail(400, 'invalid_action', 'action must be approve, reject or remove.').response;
        }
        if (!UUID.test(id)) return notFound();
        const result = await reviewProfileImage(id, action, user.guid, typeof body.reason === 'string' ? body.reason : '');
        if (!result.ok) return notFound();
        await dropFile(result.key);
        return json(200, { ok: true });
      }),
  };
}
