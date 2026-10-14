import { getPool } from './db';

export const MAX_BANNERS_PER_USER = 25;
export const MAX_NAME_LENGTH = 60;

export class BannerLimitError extends Error {}
export class DuplicateNameError extends Error {}
export class InvalidNameError extends Error {}

export type Banner = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  schemaVersion: number;
  visibility: 'private';
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  schema_version: number;
  visibility: 'private';
  created_at: Date;
  updated_at: Date;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = 'id, name, settings, schema_version, visibility, created_at, updated_at';

const toBanner = (row: Row): Banner => ({
  id: row.id,
  name: row.name,
  settings: row.settings,
  schemaVersion: row.schema_version,
  visibility: row.visibility,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export function validateName(raw: string): string {
  const name = raw.trim();
  if (name.length === 0 || [...name].length > MAX_NAME_LENGTH || /\p{Cc}/u.test(name)) {
    throw new InvalidNameError(`name must be 1-${MAX_NAME_LENGTH} characters without control characters`);
  }
  return name;
}

const isUniqueViolation = (error: unknown) => (error as { code?: string }).code === '23505';

async function requirePool() {
  const pool = await getPool();
  if (!pool) throw new Error('database_unavailable');
  return pool;
}

export async function listBanners(guid: string): Promise<Banner[]> {
  const pool = await requirePool();
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM saved_banners WHERE user_guid = $1 ORDER BY updated_at DESC, created_at DESC`,
    [guid]
  );
  return rows.map(toBanner);
}

export async function createBanner(
  guid: string,
  rawName: string,
  settings: Record<string, unknown>
): Promise<Banner> {
  const name = validateName(rawName);
  const pool = await requirePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT guid FROM users WHERE guid = $1 FOR UPDATE', [guid]);
    const { rows: counted } = await client.query<{ count: string }>(
      'SELECT count(*) FROM saved_banners WHERE user_guid = $1',
      [guid]
    );
    if (Number(counted[0].count) >= MAX_BANNERS_PER_USER) throw new BannerLimitError('banner limit reached');
    const { rows } = await client.query<Row>(
      `INSERT INTO saved_banners (user_guid, name, settings) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
      [guid, name, JSON.stringify(settings)]
    );
    await client.query('COMMIT');
    return toBanner(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (isUniqueViolation(error)) throw new DuplicateNameError('a banner with this name already exists');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateBanner(
  guid: string,
  id: string,
  patch: { name?: string; settings?: Record<string, unknown> }
): Promise<Banner | null> {
  if (!UUID.test(id)) return null;
  const name = patch.name === undefined ? undefined : validateName(patch.name);
  const pool = await requirePool();
  try {
    const { rows } = await pool.query<Row>(
      `UPDATE saved_banners
         SET name = COALESCE($3, name),
             settings = COALESCE($4::jsonb, settings),
             updated_at = NOW()
       WHERE id = $1 AND user_guid = $2
       RETURNING ${COLUMNS}`,
      [id, guid, name ?? null, patch.settings === undefined ? null : JSON.stringify(patch.settings)]
    );
    return rows[0] ? toBanner(rows[0]) : null;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateNameError('a banner with this name already exists');
    throw error;
  }
}

export async function deleteBanner(guid: string, id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const pool = await requirePool();
  const result = await pool.query('DELETE FROM saved_banners WHERE id = $1 AND user_guid = $2', [id, guid]);
  return (result.rowCount ?? 0) > 0;
}
