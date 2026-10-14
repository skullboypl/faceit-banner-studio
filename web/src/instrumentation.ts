/** Starts the Redis → Postgres workspace flush worker once per Node server process. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const globalForWorker = globalThis as unknown as { __fbFlushWorker?: unknown };
  if (globalForWorker.__fbFlushWorker) return;

  const { startFlushWorker } = await import('./server/workspace');
  const worker = startFlushWorker();
  globalForWorker.__fbFlushWorker = worker;

  const shutdown = () => void worker.stop().finally(() => process.exit(0));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
