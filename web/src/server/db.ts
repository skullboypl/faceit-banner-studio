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
      CREATE TABLE IF NOT EXISTS posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kind TEXT NOT NULL CHECK (kind IN ('request', 'bug')),
        author_guid TEXT NOT NULL REFERENCES users(guid) ON DELETE CASCADE,
        title VARCHAR(120) NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new'
          CHECK (status IN ('new', 'planned', 'in_progress', 'done', 'declined', 'duplicate')),
        context JSONB,
        votes INTEGER NOT NULL DEFAULT 0,
        comments INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        content_hash TEXT
      );
      CREATE INDEX IF NOT EXISTS posts_list ON posts (kind, status, created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS posts_top ON posts (votes DESC, created_at DESC) WHERE deleted_at IS NULL;
      CREATE TABLE IF NOT EXISTS post_votes (
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_guid TEXT NOT NULL REFERENCES users(guid) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (post_id, user_guid)
      );
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        author_guid TEXT NOT NULL REFERENCES users(guid) ON DELETE CASCADE,
        body VARCHAR(2000) NOT NULL,
        by_admin BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        content_hash TEXT
      );
      CREATE INDEX IF NOT EXISTS comments_post ON comments (post_id, created_at);
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_hash TEXT;
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS content_hash TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS posts_author_content
        ON posts (author_guid, content_hash) WHERE deleted_at IS NULL AND content_hash IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS comments_author_content
        ON comments (post_id, author_guid, content_hash) WHERE deleted_at IS NULL AND content_hash IS NOT NULL;
      CREATE TABLE IF NOT EXISTS attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_guid TEXT NOT NULL REFERENCES users(guid) ON DELETE CASCADE,
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        key TEXT NOT NULL UNIQUE,
        bytes INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS attachments_post ON attachments (post_id) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS attachments_owner_created ON attachments (owner_guid, created_at DESC);
      ALTER TABLE attachments ADD COLUMN IF NOT EXISTS content_hash TEXT;
      ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_key_key;
      CREATE INDEX IF NOT EXISTS attachments_key ON attachments (key);
      CREATE INDEX IF NOT EXISTS attachments_hash
        ON attachments (content_hash) WHERE deleted_at IS NULL AND content_hash IS NOT NULL;
      CREATE TABLE IF NOT EXISTS banner_catalog (
        mode TEXT PRIMARY KEY,
        visible BOOLEAN NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO banner_catalog (mode, visible) VALUES
        ('solo', TRUE),
        ('versus', TRUE),
        ('team', FALSE),
        ('split', FALSE),
        ('popup', FALSE)
      ON CONFLICT (mode) DO NOTHING;
      CREATE TABLE IF NOT EXISTS profile_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_guid TEXT NOT NULL REFERENCES users(guid) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('avatar', 'cover')),
        key TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        bytes INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
        reject_reason TEXT,
        reviewed_by TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (owner_guid, kind)
      );
      CREATE INDEX IF NOT EXISTS profile_images_status_created ON profile_images (status, created_at);
      CREATE TABLE IF NOT EXISTS profile_image_reports (
        image_id UUID NOT NULL REFERENCES profile_images(id) ON DELETE CASCADE,
        reporter_guid TEXT NOT NULL REFERENCES users(guid) ON DELETE CASCADE,
        reason TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (image_id, reporter_guid)
      );
    `);
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined);
    client.release();
  }
}
