export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAttachmentSweep, startWorkspaceFlushWorker } = await import('./instrumentation-node');
    startWorkspaceFlushWorker();
    startAttachmentSweep();
  }
}
