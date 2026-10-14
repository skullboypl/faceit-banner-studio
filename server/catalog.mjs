import { applyBannerCatalog, defaultBannerCatalog, normalizeBannerCatalog } from '../shared/banner-catalog.mjs';
import { postgresCall, redisCall } from './store.mjs';

/** How long a public read may answer from Redis before it loads Postgres again. */
export const CATALOG_TTL_SECONDS = 120;
const KEY = 'fb:catalog:modes';

let memory = null;
let tableReady = false;
let redisOverride;

/** Tests pass a stand-in with get/set/del. Production uses the shared Redis client. */
export function useCatalogRedisForTests(client) {
  redisOverride = client;
}

const SQL = `
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
`;

async function cacheGet() {
  if (redisOverride) return redisOverride.get(KEY);
  return redisCall((redis) => redis.get(KEY));
}

async function remember(modes) {
  const body = JSON.stringify(modes);
  if (redisOverride) {
    await redisOverride.set(KEY, body, 'EX', CATALOG_TTL_SECONDS);
    return modes;
  }
  const stored = await redisCall((redis) => redis.set(KEY, body, 'EX', CATALOG_TTL_SECONDS));
  if (stored === undefined) await redisCall((redis) => redis.del(KEY));
  return modes;
}

async function loadPostgres() {
  return postgresCall(async (pool) => {
    if (!tableReady) {
      await pool.query(SQL);
      tableReady = true;
    }
    const { rows } = await pool.query('SELECT mode, visible FROM banner_catalog');
    const seeded = defaultBannerCatalog();
    for (const row of rows) seeded[row.mode] = Boolean(row.visible);
    return normalizeBannerCatalog(seeded);
  });
}

/** Redis first. A miss reads Postgres and fills the cache. No database means the last local edit, or the defaults. */
export async function readBannerCatalog() {
  const cached = await cacheGet();
  if (typeof cached === 'string' && cached) {
    try {
      return normalizeBannerCatalog(JSON.parse(cached));
    } catch {
      /* a bad cache entry falls through to Postgres */
    }
  }
  const stored = await loadPostgres();
  const modes = stored ?? memory ?? defaultBannerCatalog();
  if (stored) await remember(modes);
  return modes;
}

/** Saves the edit in Postgres, then replaces the Redis read cache so the next F5 sees it. */
export async function writeBannerCatalog(patch) {
  const current = await readBannerCatalog();
  const modes = applyBannerCatalog(current, patch);
  const saved = await postgresCall(async (pool) => {
    if (!tableReady) {
      await pool.query(SQL);
      tableReady = true;
    }
    for (const [mode, visible] of Object.entries(modes)) {
      await pool.query(
        `INSERT INTO banner_catalog (mode, visible) VALUES ($1, $2)
         ON CONFLICT (mode) DO UPDATE SET visible = EXCLUDED.visible, updated_at = NOW()`,
        [mode, visible]
      );
    }
    return true;
  });
  if (!saved) memory = modes;
  else memory = null;
  await remember(modes);
  return modes;
}

export function resetBannerCatalogForTests() {
  memory = null;
  tableReady = false;
}
