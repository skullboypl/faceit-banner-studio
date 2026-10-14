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
