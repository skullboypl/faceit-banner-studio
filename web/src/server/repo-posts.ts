import { createHash } from 'node:crypto';
import { getPool } from './db';
import { attachmentsForPost, claimAttachments, type AttachmentView } from './repo-attachments';

export const POST_KINDS = ['request', 'bug'] as const;
export const POST_STATUSES = ['new', 'planned', 'in_progress', 'done', 'declined', 'duplicate'] as const;
export type PostKind = (typeof POST_KINDS)[number];
export type PostStatus = (typeof POST_STATUSES)[number];

export const PAGE_SIZE = 20;
export const TITLE_MIN = 3;
export const TITLE_MAX = 120;
export const BODY_MAX = 4000;
export const COMMENT_MAX = 2000;
export const CONTEXT_MAX_BYTES = 16_384;

export class InvalidPostError extends Error {}
export class DuplicateContentError extends Error {}

const isUniqueViolation = (error: unknown) => (error as { code?: string }).code === '23505';

/** Same letters, spacing and case count as the same post. The hash is not shown to clients. */
function contentHash(parts: string[]): string {
  const normalized = parts.map((part) => part.trim().replace(/\s+/g, ' ').toLowerCase()).join('\n');
  return createHash('sha256').update(normalized).digest('hex');
}

export type PostSummary = {
  id: string;
  kind: PostKind;
  title: string;
  status: PostStatus;
  votes: number;
  comments: number;
  createdAt: string;
  authorGuid: string;
  authorNickname: string;
  voted: boolean;
};

export type CommentRow = {
  id: string;
  postId: string;
  body: string;
  byAdmin: boolean;
  createdAt: string;
  authorGuid: string;
  authorNickname: string;
};

export type PostDetail = PostSummary & {
  body: string;
  context: Record<string, unknown> | null;
  thread: CommentRow[];
  attachments: AttachmentView[];
};

type PostRow = {
  id: string;
  kind: PostKind;
  title: string;
  body: string;
  status: PostStatus;
  context: Record<string, unknown> | null;
  votes: number;
  comments: number;
  created_at: Date;
  author_guid: string;
  nickname: string;
  voted: boolean;
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POST_SELECT = `p.id, p.kind, p.title, p.body, p.status, p.context, p.votes, p.comments, p.created_at,
  p.author_guid, u.nickname,
  EXISTS (SELECT 1 FROM post_votes v WHERE v.post_id = p.id AND v.user_guid = $VIEWER) AS voted`;

const length = (text: string) => [...text].length;

const toSummary = (row: PostRow): PostSummary => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  status: row.status,
  votes: row.votes,
  comments: row.comments,
  createdAt: row.created_at.toISOString(),
  authorGuid: row.author_guid,
  authorNickname: row.nickname,
  voted: row.voted,
});

async function requirePool() {
  const pool = await getPool();
  if (!pool) throw new Error('database_unavailable');
  return pool;
}

function validateText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new InvalidPostError(`${label} is required`);
  const text = value.trim();
  if (length(text) < min || length(text) > max) {
    throw new InvalidPostError(`${label} must be ${min}-${max} characters`);
  }
  return text;
}

export async function createPost(
  guid: string,
  input: { kind: PostKind; title: string; body: string; context?: Record<string, unknown> | null; attachmentIds?: string[] }
): Promise<PostSummary> {
  if (!POST_KINDS.includes(input.kind)) throw new InvalidPostError('kind must be request or bug');
  const title = validateText(input.title, 'title', TITLE_MIN, TITLE_MAX);
  const body = validateText(input.body, 'body', 1, BODY_MAX);
  const attachmentIds = input.attachmentIds ?? [];
  if (attachmentIds.length > 3) throw new InvalidPostError('attachment_limit');
  if (new Set(attachmentIds).size !== attachmentIds.length || attachmentIds.some((id) => !UUID.test(id))) {
    throw new InvalidPostError('attachment_invalid');
  }
  let context: string | null = null;
  if (input.kind === 'bug' && input.context) {
    context = JSON.stringify(input.context);
    if (Buffer.byteLength(context) > CONTEXT_MAX_BYTES) {
      throw new InvalidPostError(`context is larger than ${CONTEXT_MAX_BYTES} bytes`);
    }
  }
  const pool = await requirePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO posts (kind, author_guid, title, body, context, content_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [input.kind, guid, title, body, context, contentHash([title, body])]
    );
    if (!(await claimAttachments(client, guid, rows[0].id, attachmentIds))) {
      throw new InvalidPostError('attachment_invalid');
    }
    await client.query('COMMIT');
    const created = await fetchSummary(rows[0].id, guid);
    return created!;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (error instanceof InvalidPostError) throw error;
    if (isUniqueViolation(error)) throw new DuplicateContentError('This content has already been posted.');
    throw error;
  } finally {
    client.release();
  }
}

async function fetchSummary(id: string, viewerGuid: string | null): Promise<PostSummary | null> {
  const pool = await requirePool();
  const { rows } = await pool.query<PostRow>(
    `SELECT ${POST_SELECT.replace('$VIEWER', '$2')} FROM posts p JOIN users u ON u.guid = p.author_guid
     WHERE p.id = $1 AND p.deleted_at IS NULL`,
    [id, viewerGuid]
  );
  return rows[0] ? toSummary(rows[0]) : null;
}

type Cursor = { v: number; t: string; i: string };
const encodeCursor = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64url');
function decodeCursor(raw: string): Cursor {
  try {
    const cursor = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;
    if (typeof cursor.v !== 'number' || typeof cursor.t !== 'string' || !UUID.test(cursor.i)) throw new Error();
    if (Number.isNaN(Date.parse(cursor.t))) throw new Error();
    return cursor;
  } catch {
    throw new InvalidPostError('invalid cursor');
  }
}

export async function listPosts(options: {
  kind?: PostKind;
  status?: PostStatus;
  sort: 'top' | 'new';
  cursor?: string;
  viewerGuid?: string | null;
}): Promise<{ posts: PostSummary[]; next: string | null }> {
  const params: unknown[] = [options.viewerGuid ?? null];
  const where = ['p.deleted_at IS NULL'];
  if (options.kind) {
    if (!POST_KINDS.includes(options.kind)) throw new InvalidPostError('invalid kind');
    params.push(options.kind);
    where.push(`p.kind = $${params.length}`);
  }
  if (options.status) {
    if (!POST_STATUSES.includes(options.status)) throw new InvalidPostError('invalid status');
    params.push(options.status);
    where.push(`p.status = $${params.length}`);
  }
  if (options.cursor) {
    const cursor = decodeCursor(options.cursor);
    if (options.sort === 'top') {
      params.push(cursor.v, cursor.t, cursor.i);
      where.push(`(p.votes, p.created_at, p.id) < ($${params.length - 2}, $${params.length - 1}::timestamptz, $${params.length})`);
    } else {
      params.push(cursor.t, cursor.i);
      where.push(`(p.created_at, p.id) < ($${params.length - 1}::timestamptz, $${params.length})`);
    }
  }
  const order = options.sort === 'top' ? 'p.votes DESC, p.created_at DESC, p.id DESC' : 'p.created_at DESC, p.id DESC';
  params.push(PAGE_SIZE + 1);

  const pool = await requirePool();
  const { rows } = await pool.query<PostRow>(
    `SELECT ${POST_SELECT.replace('$VIEWER', '$1')} FROM posts p JOIN users u ON u.guid = p.author_guid
     WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT $${params.length}`,
    params
  );
  const page = rows.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];
  return {
    posts: page.map(toSummary),
    next:
      rows.length > PAGE_SIZE && last
        ? encodeCursor({ v: last.votes, t: last.created_at.toISOString(), i: last.id })
        : null,
  };
}

async function fetchThread(postId: string): Promise<CommentRow[]> {
  const pool = await requirePool();
  const { rows } = await pool.query(
    `SELECT c.id, c.post_id, c.body, c.by_admin, c.created_at, c.author_guid, u.nickname
     FROM comments c JOIN users u ON u.guid = c.author_guid
     WHERE c.post_id = $1 AND c.deleted_at IS NULL ORDER BY c.created_at, c.id`,
    [postId]
  );
  return rows.map(toComment);
}

const toComment = (row: {
  id: string;
  post_id: string;
  body: string;
  by_admin: boolean;
  created_at: Date;
  author_guid: string;
  nickname: string;
}): CommentRow => ({
  id: row.id,
  postId: row.post_id,
  body: row.body,
  byAdmin: row.by_admin,
  createdAt: row.created_at.toISOString(),
  authorGuid: row.author_guid,
  authorNickname: row.nickname,
});

export async function getPost(id: string, viewerGuid: string | null): Promise<PostDetail | null> {
  if (!UUID.test(id)) return null;
  const pool = await requirePool();
  const { rows } = await pool.query<PostRow>(
    `SELECT ${POST_SELECT.replace('$VIEWER', '$2')} FROM posts p JOIN users u ON u.guid = p.author_guid
     WHERE p.id = $1 AND p.deleted_at IS NULL`,
    [id, viewerGuid]
  );
  if (!rows[0]) return null;
  const [thread, attachments] = await Promise.all([fetchThread(id), attachmentsForPost(id)]);
  return { ...toSummary(rows[0]), body: rows[0].body, context: rows[0].context, thread, attachments };
}

export async function toggleVote(guid: string, postId: string): Promise<{ voted: boolean; votes: number } | null> {
  if (!UUID.test(postId)) return null;
  const pool = await requirePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Locking the post row serialises every vote on it, so the counter can be recounted safely.
    const locked = await client.query('SELECT id FROM posts WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [postId]);
    if (locked.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const removed = await client.query('DELETE FROM post_votes WHERE post_id = $1 AND user_guid = $2', [postId, guid]);
    const voted = (removed.rowCount ?? 0) === 0;
    if (voted) await client.query('INSERT INTO post_votes (post_id, user_guid) VALUES ($1, $2)', [postId, guid]);
    const { rows } = await client.query<{ votes: number }>(
      'UPDATE posts SET votes = (SELECT count(*) FROM post_votes WHERE post_id = $1) WHERE id = $1 RETURNING votes',
      [postId]
    );
    await client.query('COMMIT');
    return { voted, votes: rows[0].votes };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const recountComments = (client: { query: (text: string, values: unknown[]) => Promise<unknown> }, postId: string) =>
  client.query(
    'UPDATE posts SET comments = (SELECT count(*) FROM comments WHERE post_id = $1 AND deleted_at IS NULL) WHERE id = $1',
    [postId]
  );

export async function addComment(
  guid: string,
  postId: string,
  rawBody: string,
  byAdmin: boolean
): Promise<CommentRow | null> {
  const body = validateText(rawBody, 'comment', 1, COMMENT_MAX);
  if (!UUID.test(postId)) return null;
  const pool = await requirePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query('SELECT id FROM posts WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [postId]);
    if (locked.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const { rows } = await client.query(
      `WITH c AS (INSERT INTO comments (post_id, author_guid, body, by_admin, content_hash) VALUES ($1, $2, $3, $4, $5) RETURNING *)
       SELECT c.id, c.post_id, c.body, c.by_admin, c.created_at, c.author_guid, u.nickname
       FROM c JOIN users u ON u.guid = c.author_guid`,
      [postId, guid, body, byAdmin, contentHash([body])]
    );
    await recountComments(client, postId);
    await client.query('COMMIT');
    return toComment(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (isUniqueViolation(error)) throw new DuplicateContentError('This content has already been posted.');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteComment(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const pool = await requirePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ post_id: string }>(
      'UPDATE comments SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING post_id',
      [id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return false;
    }
    await recountComments(client, rows[0].post_id);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setStatus(id: string, status: PostStatus): Promise<PostSummary | null> {
  if (!UUID.test(id) || !POST_STATUSES.includes(status)) return null;
  const pool = await requirePool();
  const { rowCount } = await pool.query(
    'UPDATE posts SET status = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
    [id, status]
  );
  return rowCount ? fetchSummary(id, null) : null;
}

export async function deletePost(
  id: string,
  actor: { guid: string; admin: boolean }
): Promise<'deleted' | 'forbidden' | 'not_found'> {
  if (!UUID.test(id)) return 'not_found';
  const pool = await requirePool();
  const { rows } = await pool.query<{ author_guid: string }>(
    'SELECT author_guid FROM posts WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!rows[0]) return 'not_found';
  if (!actor.admin) {
    if (rows[0].author_guid !== actor.guid) return 'forbidden';
    const foreign = await pool.query(
      'SELECT 1 FROM comments WHERE post_id = $1 AND author_guid <> $2 AND deleted_at IS NULL LIMIT 1',
      [id, actor.guid]
    );
    if ((foreign.rowCount ?? 0) > 0) return 'forbidden';
  }
  await pool.query('UPDATE posts SET deleted_at = NOW() WHERE id = $1', [id]);
  return 'deleted';
}

/** Markdown meant to be pasted into a chat with Claude. */
export async function exportPost(id: string): Promise<string | null> {
  const post = await getPost(id, null);
  if (!post) return null;
  const lines = [
    `# ${post.title}`,
    '',
    `- Type: ${post.kind}`,
    `- Status: ${post.status}`,
    `- Votes: ${post.votes}`,
    `- Author: ${post.authorNickname}`,
    `- Created: ${post.createdAt}`,
    `- ID: ${post.id}`,
    '',
    '## Description',
    '',
    post.body,
  ];
  if (post.context) {
    lines.push('', '## Context', '', '```json', JSON.stringify(post.context, null, 2), '```');
  }
  if (post.attachments.length) {
    lines.push('', '## Screenshots', '');
    post.attachments.forEach((image, index) => lines.push(`${index + 1}. ${image.url}`));
  }
  lines.push('', `## Comments (${post.thread.length})`, '');
  post.thread.forEach((comment, index) => {
    const who = comment.byAdmin ? `${comment.authorNickname} (admin)` : comment.authorNickname;
    lines.push(`${index + 1}. **${who}** (${comment.createdAt}): ${comment.body.replace(/\n+/g, ' ')}`);
  });
  return lines.join('\n');
}
