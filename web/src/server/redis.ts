import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { __fbRedis?: { url: string; client: Redis } };

/**
 * Shared client for REDIS_URL, `null` when it is not configured.
 * Commands fail fast while Redis is down (no offline queue), so callers can fall back to Postgres.
 */
export async function getRedis(): Promise<Redis | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const cached = globalForRedis.__fbRedis;
  if (cached?.url === url) return cached.client;
  if (cached) cached.client.disconnect();

  const client = new Redis(url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
    lazyConnect: true,
  });
  client.on('error', () => undefined);
  await client.connect().catch(() => undefined);
  globalForRedis.__fbRedis = { url, client };
  return client;
}
