import { attachmentKeysToPurge, removeAttachmentRow } from './repo-attachments';
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
  let removed = 0;
  for (const row of rows) {
    try {
      await deleteObject(row.key);
      await removeAttachmentRow(row.id);
      removed += 1;
    } catch {
      // Leave the row. The next pass tries the object again.
    }
  }
  return removed;
}
