import { sweepAttachments } from './server/attachment-sweep';
import { startFlushWorker } from './server/workspace';

/** Starts the Redis → Postgres workspace flush worker once per Node server process. */
export function startWorkspaceFlushWorker() {
  const globalForWorker = globalThis as unknown as { __fbFlushWorker?: unknown };
  if (globalForWorker.__fbFlushWorker) return;

  const worker = startFlushWorker();
  globalForWorker.__fbFlushWorker = worker;

  const shutdown = () => void worker.stop().finally(() => process.exit(0));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

const SWEEP_MS = 15 * 60 * 1000;

/** Drops screenshots that were never attached, plus objects already hidden by an admin or a deleted post. */
export function startAttachmentSweep() {
  const globalForSweep = globalThis as unknown as { __fbAttachmentSweep?: ReturnType<typeof setInterval> };
  if (globalForSweep.__fbAttachmentSweep) return;
  const tick = () => void sweepAttachments().catch(() => undefined);
  globalForSweep.__fbAttachmentSweep = setInterval(tick, SWEEP_MS);
  setTimeout(tick, 60_000);
}
