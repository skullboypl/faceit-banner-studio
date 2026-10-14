export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startWorkspaceFlushWorker } = await import('./instrumentation-node');
    startWorkspaceFlushWorker();
  }
}
