import pg from 'pg';

const globalForPool = globalThis as unknown as { __fbPool?: pg.Pool };

/** Shared pool (survives Next.js dev reloads); `null` when DATABASE_URL is not set. */
export async function getPool(): Promise<pg.Pool | null> {
  if (!process.env.DATABASE_URL) return null;
  if (!globalForPool.__fbPool) {
    globalForPool.__fbPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    await migrate(globalForPool.__fbPool);
  }
  return globalForPool.__fbPool;
}

/** Idempotent; also safe when two server processes start at once (advisory lock). */
export async function migrate(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727001)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        guid TEXT PRIMARY KEY,
        nickname VARCHAR(64) NOT NULL,
        avatar VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS saved_banners (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_guid TEXT NOT NULL REFERENCES users(guid) ON DELETE CASCADE,
        name VARCHAR(60) NOT NULL,
        settings JSONB NOT NULL,
        schema_version INTEGER NOT NULL DEFAULT 1,
        visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS saved_banners_user_name
        ON saved_banners (user_guid, lower(name));
      CREATE INDEX IF NOT EXISTS saved_banners_user_updated
        ON saved_banners (user_guid, updated_at DESC);
      CREATE TABLE IF NOT EXISTS user_workspace (
        user_guid TEXT PRIMARY KEY REFERENCES users(guid) ON DELETE CASCADE,
        settings JSONB NOT NULL,
        version BIGINT NOT NULL,
        device_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined);
    client.release();
  }
}
