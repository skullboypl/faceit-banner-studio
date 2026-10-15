import { getPool } from './db';
import { REPORT_HIDE_THRESHOLD, type ProfileKind } from './profile-images';

export type ProfileImageStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

export type ProfileImageRow = {
  id: string;
  ownerGuid: string;
  kind: ProfileKind;
  key: string;
  width: number;
  height: number;
  bytes: number;
  status: ProfileImageStatus;
  rejectReason: string | null;
  createdAt: string;
};

export type ReviewRow = ProfileImageRow & { nickname: string; reports: number };

type Raw = {
  id: string;
  owner_guid: string;
  kind: ProfileKind;
  key: string;
  width: number;
  height: number;
  bytes: number;
  status: ProfileImageStatus;
  reject_reason: string | null;
  created_at: Date;
};

const COLUMNS = 'id, owner_guid, kind, key, width, height, bytes, status, reject_reason, created_at';

const toRow = (row: Raw): ProfileImageRow => ({
  id: row.id,
  ownerGuid: row.owner_guid,
  kind: row.kind,
  key: row.key,
  width: row.width,
  height: row.height,
  bytes: row.bytes,
  status: row.status,
  rejectReason: row.reject_reason,
  createdAt: row.created_at.toISOString(),
});

async function pool() {
  const current = await getPool();
  if (!current) throw new Error('database_unavailable');
  return current;
}

/**
 * One image per owner and kind. A new file replaces the old one, goes back to review (an admin's own
 * upload is approved at once) and starts with no reports. The old file is returned so it can be deleted.
 */
export async function saveProfileImage(input: {
  ownerGuid: string;
  kind: ProfileKind;
  key: string;
  width: number;
  height: number;
  bytes: number;
  approved: boolean;
}): Promise<{ image: ProfileImageRow; replacedKey: string | null }> {
  const db = await pool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const previous = await client.query<{ id: string; key: string }>(
      'SELECT id, key FROM profile_images WHERE owner_guid = $1 AND kind = $2 FOR UPDATE',
      [input.ownerGuid, input.kind]
    );
    const status: ProfileImageStatus = input.approved ? 'approved' : 'pending';
    const { rows } = await client.query<Raw>(
      `INSERT INTO profile_images (owner_guid, kind, key, width, height, bytes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (owner_guid, kind) DO UPDATE SET
         key = EXCLUDED.key, width = EXCLUDED.width, height = EXCLUDED.height, bytes = EXCLUDED.bytes,
         status = EXCLUDED.status, reject_reason = NULL, reviewed_by = NULL, reviewed_at = NULL, created_at = NOW()
       RETURNING ${COLUMNS}`,
      [input.ownerGuid, input.kind, input.key, input.width, input.height, input.bytes, status]
    );
    if (previous.rows[0]) await client.query('DELETE FROM profile_image_reports WHERE image_id = $1', [previous.rows[0].id]);
    await client.query('COMMIT');
    return { image: toRow(rows[0]), replacedKey: previous.rows[0]?.key ?? null };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Everything the owner has, with its status, so the panel can show what is waiting or was refused. */
export async function listOwnProfileImages(ownerGuid: string): Promise<ProfileImageRow[]> {
  const { rows } = await (await pool()).query<Raw>(
    `SELECT ${COLUMNS} FROM profile_images WHERE owner_guid = $1 ORDER BY kind`,
    [ownerGuid]
  );
  return rows.map(toRow);
}

/** What anybody may see: approved images only. */
export async function listApprovedProfileImages(ownerGuid: string): Promise<ProfileImageRow[]> {
  const { rows } = await (await pool()).query<Raw>(
    `SELECT ${COLUMNS} FROM profile_images WHERE owner_guid = $1 AND status = 'approved' ORDER BY kind`,
    [ownerGuid]
  );
  return rows.map(toRow);
}

/** Removes the owner's image of one kind; returns the file to delete, or null when there was none. */
export async function deleteProfileImage(ownerGuid: string, kind: ProfileKind): Promise<string | null> {
  const { rows } = await (await pool()).query<{ key: string }>(
    'DELETE FROM profile_images WHERE owner_guid = $1 AND kind = $2 RETURNING key',
    [ownerGuid, kind]
  );
  return rows[0]?.key ?? null;
}

export type ReportOutcome = 'reported' | 'hidden' | 'duplicate' | 'own' | 'not_found';

/**
 * A logged-in user reports somebody else's approved image, once. The third different reporter
 * hides it until an admin decides. Reporters are never shown to the owner.
 */
export async function reportProfileImage(input: {
  ownerGuid: string;
  kind: ProfileKind;
  reporterGuid: string;
  reason: string;
}): Promise<ReportOutcome> {
  if (input.ownerGuid === input.reporterGuid) return 'own';
  const db = await pool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query<{ id: string }>(
      `SELECT id FROM profile_images WHERE owner_guid = $1 AND kind = $2 AND status = 'approved' FOR UPDATE`,
      [input.ownerGuid, input.kind]
    );
    const image = found.rows[0];
    if (!image) {
      await client.query('ROLLBACK');
      return 'not_found';
    }
    const inserted = await client.query(
      `INSERT INTO profile_image_reports (image_id, reporter_guid, reason) VALUES ($1, $2, $3)
       ON CONFLICT (image_id, reporter_guid) DO NOTHING`,
      [image.id, input.reporterGuid, input.reason.trim().slice(0, 300)]
    );
    if (inserted.rowCount === 0) {
      await client.query('ROLLBACK');
      return 'duplicate';
    }
    const { rows } = await client.query<{ total: string }>('SELECT COUNT(*) AS total FROM profile_image_reports WHERE image_id = $1', [image.id]);
    const hide = Number(rows[0].total) >= REPORT_HIDE_THRESHOLD;
    if (hide) await client.query(`UPDATE profile_images SET status = 'hidden' WHERE id = $1`, [image.id]);
    await client.query('COMMIT');
    return hide ? 'hidden' : 'reported';
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export type ReviewFilter = 'pending' | 'reported' | 'hidden' | 'all';

/** The moderation queue. "reported" lists approved or hidden images that have reports, most reported first. */
export async function listForReview(filter: ReviewFilter, limit: number): Promise<ReviewRow[]> {
  const where: string[] =
    filter === 'pending'
      ? [`p.status = 'pending'`]
      : filter === 'hidden'
        ? [`p.status = 'hidden'`]
        : filter === 'reported'
          ? [`p.status IN ('approved', 'hidden')`, 'COALESCE(r.total, 0) > 0']
          : ['TRUE'];
  const order = filter === 'reported' ? 'COALESCE(r.total, 0) DESC, p.created_at' : 'p.created_at';
  const { rows } = await (await pool()).query<Raw & { nickname: string; reports: string }>(
    `SELECT p.id, p.owner_guid, p.kind, p.key, p.width, p.height, p.bytes, p.status, p.reject_reason, p.created_at,
            u.nickname, COALESCE(r.total, 0) AS reports
     FROM profile_images p
     JOIN users u ON u.guid = p.owner_guid
     LEFT JOIN (SELECT image_id, COUNT(*) AS total FROM profile_image_reports GROUP BY image_id) r ON r.image_id = p.id
     WHERE ${where.join(' AND ')}
     ORDER BY ${order}
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 200)]
  );
  return rows.map((row) => ({ ...toRow(row), nickname: row.nickname, reports: Number(row.reports) }));
}

export type ReviewAction = 'approve' | 'reject' | 'remove';

/** Admin decision. `remove` deletes the row and returns the file to delete; the others return key null. */
export async function reviewProfileImage(
  id: string,
  action: ReviewAction,
  adminGuid: string,
  reason = ''
): Promise<{ ok: false } | { ok: true; key: string | null }> {
  const db = await pool();
  if (action === 'remove') {
    const { rows } = await db.query<{ key: string }>('DELETE FROM profile_images WHERE id = $1 RETURNING key', [id]);
    return rows[0] ? { ok: true, key: rows[0].key } : { ok: false };
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const status = action === 'approve' ? 'approved' : 'rejected';
    const { rowCount } = await client.query(
      `UPDATE profile_images SET status = $2, reject_reason = $3, reviewed_by = $4, reviewed_at = NOW() WHERE id = $1`,
      [id, status, action === 'reject' ? reason.trim().slice(0, 300) || null : null, adminGuid]
    );
    if (!rowCount) {
      await client.query('ROLLBACK');
      return { ok: false };
    }
    if (action === 'approve') await client.query('DELETE FROM profile_image_reports WHERE image_id = $1', [id]);
    await client.query('COMMIT');
    return { ok: true, key: null };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
