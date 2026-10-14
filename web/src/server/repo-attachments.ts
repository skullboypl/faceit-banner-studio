import type { PoolClient } from 'pg';
import { getPool } from './db';
import { publicUrl } from './r2';

export type AttachmentView = { id: string; url: string; width: number; height: number };

async function pool() {
  const current = await getPool();
  if (!current) throw new Error('database_unavailable');
  return current;
}

export async function insertAttachment(input: {
  ownerGuid: string;
  key: string;
  bytes: number;
  width: number;
  height: number;
}): Promise<{ id: string }> {
  const { rows } = await (await pool()).query<{ id: string }>(
    `INSERT INTO attachments (owner_guid, key, bytes, width, height) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.ownerGuid, input.key, input.bytes, input.width, input.height]
  );
  return rows[0];
}

/** Pins unattached images owned by this user. Returns false when any id is missing, foreign or already used. */
export async function claimAttachments(client: PoolClient, ownerGuid: string, postId: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const { rows } = await client.query<{ id: string }>(
    `UPDATE attachments SET post_id = $1
     WHERE id = ANY($2::uuid[]) AND owner_guid = $3 AND post_id IS NULL AND deleted_at IS NULL
     RETURNING id`,
    [postId, ids, ownerGuid]
  );
  return rows.length === ids.length;
}

const toView = (row: { id: string; key: string; width: number; height: number }): AttachmentView => ({
  id: row.id,
  url: publicUrl(row.key),
  width: row.width,
  height: row.height,
});

export async function attachmentsForPost(postId: string): Promise<AttachmentView[]> {
  if (!process.env.R2_PUBLIC_URL) return [];
  const { rows } = await (await pool()).query<{ id: string; key: string; width: number; height: number }>(
    `SELECT id, key, width, height FROM attachments
     WHERE post_id = $1 AND deleted_at IS NULL ORDER BY created_at, id`,
    [postId]
  );
  return rows.map(toView);
}

export async function attachmentsForPosts(postIds: string[]): Promise<Map<string, AttachmentView[]>> {
  const grouped = new Map<string, AttachmentView[]>();
  if (postIds.length === 0 || !process.env.R2_PUBLIC_URL) return grouped;
  const { rows } = await (await pool()).query<{ post_id: string; id: string; key: string; width: number; height: number }>(
    `SELECT post_id, id, key, width, height FROM attachments
     WHERE post_id = ANY($1::uuid[]) AND deleted_at IS NULL ORDER BY created_at, id`,
    [postIds]
  );
  for (const row of rows) {
    const list = grouped.get(row.post_id) ?? [];
    list.push(toView(row));
    grouped.set(row.post_id, list);
  }
  return grouped;
}

/** Hides the image immediately. The stored key is what the sweeper deletes from R2. */
export async function softDeleteAttachment(id: string): Promise<string | null> {
  const { rows } = await (await pool()).query<{ key: string }>(
    `UPDATE attachments SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING key`,
    [id]
  );
  return rows[0]?.key ?? null;
}

/** Orphans older than a day, images an admin already hid, and images on a deleted post. */
export async function attachmentKeysToPurge(olderThan: Date): Promise<{ id: string; key: string }[]> {
  const { rows } = await (await pool()).query<{ id: string; key: string }>(
    `SELECT a.id, a.key FROM attachments a
     LEFT JOIN posts p ON p.id = a.post_id
     WHERE (a.post_id IS NULL AND a.created_at < $1)
        OR a.deleted_at IS NOT NULL
        OR p.deleted_at IS NOT NULL
     ORDER BY a.created_at LIMIT 40`,
    [olderThan]
  );
  return rows;
}

export async function removeAttachmentRow(id: string): Promise<void> {
  await (await pool()).query('DELETE FROM attachments WHERE id = $1', [id]);
}
