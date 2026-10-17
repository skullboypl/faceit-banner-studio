import { getPool } from './db';

export const PUBLICATION_STATUSES = ['pending', 'approved', 'declined'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export type VoteValue = -1 | 1;

export const PAGE_SIZE = 20;
export const TITLE_MIN = 3;
export const TITLE_MAX = 80;
export const BODY_MIN = 10;
export const BODY_MAX = 500;

export class InvalidPublicationError extends Error {}
export class DuplicatePublicationError extends Error {}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Publication = {
  id: string;
  bannerId: string;
  title: string;
  body: string;
  status: PublicationStatus;
  votes: number;
  vote: -1 | 0 | 1;
  settings: Record<string, unknown>;
  schemaVersion: number;
  createdAt: string;
  authorGuid: string;
  authorNickname: string;
};

type Row = {
  id: string;
  banner_id: string;
  title: string;
  body: string;
  status: PublicationStatus;
  votes: number;
  settings: Record<string, unknown>;
  schema_version: number;
  created_at: Date;
  author_guid: string;
  nickname: string;
  vote: number | null;
};

const SELECT = `p.id, p.banner_id, p.title, p.body, p.status, p.votes, p.settings, p.schema_version, p.created_at,
  p.author_guid, u.nickname,
  (SELECT v.value FROM banner_publication_votes v WHERE v.publication_id = p.id AND v.user_guid = $VIEWER) AS vote`;

const length = (text: string) => [...text].length;
const isUniqueViolation = (error: unknown) => (error as { code?: string }).code === '23505';

const toPublication = (row: Row): Publication => ({
  id: row.id,
  bannerId: row.banner_id,
  title: row.title,
  body: row.body,
  status: row.status,
  votes: row.votes,
  vote: row.vote === 1 || row.vote === -1 ? row.vote : 0,
  settings: row.settings,
  schemaVersion: row.schema_version,
  createdAt: row.created_at.toISOString(),
  authorGuid: row.author_guid,
  authorNickname: row.nickname,
});

async function requirePool() {
  const pool = await getPool();
  if (!pool) throw new Error('database_unavailable');
  return pool;
}

export function validateTitle(raw: string): string {
  const title = raw.trim().replace(/\s+/g, ' ');
  const size = length(title);
  if (size < TITLE_MIN || size > TITLE_MAX || /\p{Cc}/u.test(title)) {
    throw new InvalidPublicationError(`title must be ${TITLE_MIN}-${TITLE_MAX} characters`);
  }
  return title;
}

export function validateBody(raw: string): string {
  const body = raw.trim();
  const size = length(body);
  if (size < BODY_MIN || size > BODY_MAX || /\p{Cc}/u.test(body)) {
    throw new InvalidPublicationError(`description must be ${BODY_MIN}-${BODY_MAX} characters`);
  }
  return body;
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
    throw new InvalidPublicationError('invalid cursor');
  }
}

export async function publishBanner(
  guid: string,
  bannerId: string,
  rawTitle: string,
  rawBody: string
): Promise<Publication> {
  if (!UUID.test(bannerId)) throw new InvalidPublicationError('invalid banner');
  const title = validateTitle(rawTitle);
  const body = validateBody(rawBody);
  const pool = await requirePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: owned } = await client.query<{ id: string; settings: Record<string, unknown>; schema_version: number }>(
      'SELECT id, settings, schema_version FROM saved_banners WHERE id = $1 AND user_guid = $2 FOR UPDATE',
      [bannerId, guid]
    );
    if (!owned[0]) {
      await client.query('ROLLBACK');
      return Promise.reject(Object.assign(new Error('not_found'), { code: 'not_found' }));
    }
    const { rows } = await client.query<Row>(
      `INSERT INTO banner_publications (banner_id, author_guid, title, body, settings, schema_version)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, banner_id, title, body, status, votes, settings, schema_version, created_at, author_guid,
         $2::text AS nickname, NULL::smallint AS vote`,
      [bannerId, guid, title, body, owned[0].settings, owned[0].schema_version]
    );
    await client.query('COMMIT');
    const created = rows[0];
    const { rows: nick } = await pool.query<{ nickname: string }>('SELECT nickname FROM users WHERE guid = $1', [guid]);
    created.nickname = nick[0]?.nickname ?? '';
    return toPublication(created);
  } catch (error) {
    await client.query('ROLLBACK');
    if (isUniqueViolation(error)) throw new DuplicatePublicationError('This banner is already waiting or public.');
    throw error;
  } finally {
    client.release();
  }
}

export async function listCatalog(options: {
  sort: 'top' | 'new';
  cursor?: string;
  viewerGuid: string | null;
}): Promise<{ publications: Publication[]; next: string | null }> {
  const pool = await requirePool();
  const viewer = options.viewerGuid ?? '';
  const params: unknown[] = [viewer];
  const where = [`p.status = 'approved'`];
  if (options.cursor) {
    const cursor = decodeCursor(options.cursor);
    params.push(cursor.v, cursor.t, cursor.i);
    if (options.sort === 'top') {
      where.push(`(p.votes, p.created_at, p.id) < ($${params.length - 2}, $${params.length - 1}::timestamptz, $${params.length})`);
    } else {
      where.push(`(p.created_at, p.id) < ($${params.length - 1}::timestamptz, $${params.length})`);
    }
  }
  const order = options.sort === 'top' ? 'p.votes DESC, p.created_at DESC, p.id DESC' : 'p.created_at DESC, p.id DESC';
  const { rows } = await pool.query<Row>(
    `SELECT ${SELECT.replace('$VIEWER', '$1')} FROM banner_publications p JOIN users u ON u.guid = p.author_guid
     WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${PAGE_SIZE + 1}`,
    params
  );
  const extra = rows.length > PAGE_SIZE;
  const page = extra ? rows.slice(0, PAGE_SIZE) : rows;
  const last = page[page.length - 1];
  return {
    publications: page.map(toPublication),
    next:
      extra && last
        ? encodeCursor({ v: last.votes, t: last.created_at.toISOString(), i: last.id })
        : null,
  };
}

export async function listMine(guid: string): Promise<Publication[]> {
  const pool = await requirePool();
  const { rows } = await pool.query<Row>(
    `SELECT ${SELECT.replace('$VIEWER', '$1')} FROM banner_publications p JOIN users u ON u.guid = p.author_guid
     WHERE p.author_guid = $1 ORDER BY p.created_at DESC`,
    [guid]
  );
  return rows.map(toPublication);
}

export async function adminList(options: {
  status?: PublicationStatus;
  cursor?: string;
}): Promise<{ publications: Publication[]; next: string | null }> {
  const pool = await requirePool();
  const params: unknown[] = [''];
  const where = options.status ? ['p.status = $2'] : [];
  if (options.status) params.push(options.status);
  if (options.cursor) {
    const cursor = decodeCursor(options.cursor);
    params.push(cursor.t, cursor.i);
    where.push(`(p.created_at, p.id) < ($${params.length - 1}::timestamptz, $${params.length})`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query<Row>(
    `SELECT ${SELECT.replace('$VIEWER', '$1')} FROM banner_publications p JOIN users u ON u.guid = p.author_guid
     ${clause} ORDER BY p.created_at DESC, p.id DESC LIMIT ${PAGE_SIZE + 1}`,
    params
  );
  const extra = rows.length > PAGE_SIZE;
  const page = extra ? rows.slice(0, PAGE_SIZE) : rows;
  const last = page[page.length - 1];
  return {
    publications: page.map(toPublication),
    next: extra && last ? encodeCursor({ v: last.votes, t: last.created_at.toISOString(), i: last.id }) : null,
  };
}

export async function setPublicationStatus(id: string, status: PublicationStatus): Promise<Publication | null> {
  if (!UUID.test(id)) return null;
  if (!PUBLICATION_STATUSES.includes(status)) throw new InvalidPublicationError('invalid status');
  const pool = await requirePool();
  const { rows } = await pool.query<Row>(
    `UPDATE banner_publications p SET status = $2, updated_at = NOW(), reviewed_at = NOW()
     FROM users u
     WHERE p.id = $1 AND u.guid = p.author_guid
     RETURNING p.id, p.banner_id, p.title, p.body, p.status, p.votes, p.settings, p.schema_version, p.created_at,
       p.author_guid, u.nickname, NULL::smallint AS vote`,
    [id, status]
  );
  return rows[0] ? toPublication(rows[0]) : null;
}

export async function withdrawPublication(guid: string, id: string): Promise<'ok' | 'not_found'> {
  if (!UUID.test(id)) return 'not_found';
  const pool = await requirePool();
  const { rowCount } = await pool.query(
    'DELETE FROM banner_publications WHERE id = $1 AND author_guid = $2',
    [id, guid]
  );
  return (rowCount ?? 0) > 0 ? 'ok' : 'not_found';
}

export async function setVote(
  guid: string,
  id: string,
  value: VoteValue
): Promise<{ votes: number; vote: -1 | 0 | 1 } | null> {
  if (!UUID.test(id)) return null;
  if (value !== 1 && value !== -1) throw new InvalidPublicationError('vote must be 1 or -1');
  const pool = await requirePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: found } = await client.query<{ id: string; status: PublicationStatus }>(
      'SELECT id, status FROM banner_publications WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (!found[0] || found[0].status !== 'approved') {
      await client.query('ROLLBACK');
      return null;
    }
    const { rows: current } = await client.query<{ value: number }>(
      'SELECT value FROM banner_publication_votes WHERE publication_id = $1 AND user_guid = $2',
      [id, guid]
    );
    const previous = current[0]?.value;
    if (previous === value) {
      await client.query('DELETE FROM banner_publication_votes WHERE publication_id = $1 AND user_guid = $2', [id, guid]);
    } else if (previous) {
      await client.query(
        'UPDATE banner_publication_votes SET value = $3 WHERE publication_id = $1 AND user_guid = $2',
        [id, guid, value]
      );
    } else {
      await client.query('INSERT INTO banner_publication_votes (publication_id, user_guid, value) VALUES ($1, $2, $3)', [
        id,
        guid,
        value,
      ]);
    }
    const { rows } = await client.query<{ votes: number }>(
      `UPDATE banner_publications SET votes = COALESCE((SELECT SUM(value)::int FROM banner_publication_votes WHERE publication_id = $1), 0)
       WHERE id = $1 RETURNING votes`,
      [id]
    );
    await client.query('COMMIT');
    const next = previous === value ? 0 : value;
    return { votes: Number(rows[0].votes), vote: next };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
