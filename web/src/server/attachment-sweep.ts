import { attachmentKeysToPurge, hasLiveObject, removeAttachmentRow } from './repo-attachments';
import { getRedis } from './redis';
import { deleteObject, isR2Configured } from './r2';

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCK_KEY = 'fb:r2:sweep';

/** Deletes abandoned and already-hidden objects. A Redis lock keeps two processes from doing it twice. */
export async function sweepAttachments(now = new Date(), options: { lock?: boolean } = {}): Promise<number> {
  if (!isR2Configured()) return 0;
  if (options.lock !== false) {
    const redis = await getRedis();
    if (redis) {
      const locked = await redis.set(LOCK_KEY, '1', 'EX', 300, 'NX');
      if (locked !== 'OK') return 0;
    }
  }
  const rows = await attachmentKeysToPurge(new Date(now.getTime() - DAY_MS));
  const exceptIds = rows.map((row) => row.id);
  let removed = 0;
  const pending = new Map<string, string[]>();
  for (const row of rows) {
    if (await hasLiveObject(row.key, exceptIds)) {
      try {
        await removeAttachmentRow(row.id);
        removed += 1;
      } catch {
        // The row stays and the next pass tries again. The shared file is left in R2.
      }
      continue;
    }
    const ids = pending.get(row.key) ?? [];
    ids.push(row.id);
    pending.set(row.key, ids);
  }
  for (const [key, ids] of pending) {
    try {
      await deleteObject(key);
      for (const id of ids) await removeAttachmentRow(id);
      removed += ids.length;
    } catch {
      // Leave the rows. The next pass tries the object again.
    }
  }
  return removed;
}
