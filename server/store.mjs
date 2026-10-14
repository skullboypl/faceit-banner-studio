/**
 * Storage for login sessions (Redis) and the login history (PostgreSQL).
 * Both are optional: without REDIS_URL / DATABASE_URL the data lives in memory,
 * which is enough for local development but is lost on restart.
 */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const memorySessions = new Map();
const memoryLogins = [];

let redisPromise;
let postgresPromise;
let redisDownUntil = 0;
let postgresDownUntil = 0;

function markRedisDown(error) {
  console.error('redis unavailable, sessions stay in memory:', error?.message || error);
  redisDownUntil = Date.now() + 15_000;
  redisPromise = undefined;
}

function markPostgresDown(error) {
  console.error('postgres unavailable, login history stays in memory:', error?.message || error);
  postgresDownUntil = Date.now() + 15_000;
  postgresPromise = undefined;
}

async function getRedis() {
  if (!process.env.REDIS_URL || Date.now() < redisDownUntil) return null;
  redisPromise ??= import('ioredis')
    .then(async ({ default: Redis }) => {
      const client = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 2000,
        retryStrategy: () => null,
      });
      client.on('error', markRedisDown);
      await client.connect();
      return client;
    })
    .catch((error) => {
      markRedisDown(error);
      return null;
    });
  return redisPromise;
}

async function getPostgres() {
  if (!process.env.DATABASE_URL || Date.now() < postgresDownUntil) return null;
  postgresPromise ??= import('pg')
    .then(async ({ default: pg }) => {
      const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        connectionTimeoutMillis: 2000,
      });
      pool.on('error', markPostgresDown);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS logins (
          id BIGSERIAL PRIMARY KEY,
          guid VARCHAR(64) NOT NULL,
          nickname VARCHAR(64) NOT NULL,
          avatar VARCHAR(255),
          ip VARCHAR(64),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_logins_guid ON logins (guid);
        CREATE INDEX IF NOT EXISTS idx_logins_created ON logins (created_at);
      `);
      return pool;
    })
    .catch((error) => {
      markPostgresDown(error);
      return null;
    });
  return postgresPromise;
}

async function withRedis(run) {
  try {
    const redis = await getRedis();
    if (!redis) return false;
    await run(redis);
    return true;
  } catch (error) {
    markRedisDown(error);
    return false;
  }
}

export async function saveSession(id, user) {
  const stored = await withRedis((redis) =>
    redis.set(`fb:session:${id}`, JSON.stringify(user), 'EX', SESSION_TTL_SECONDS)
  );
  if (stored) return;
  memorySessions.set(id, { user, expires: Date.now() + SESSION_TTL_SECONDS * 1000 });
}

export async function loadSession(id) {
  try {
    const redis = await getRedis();
    if (redis) {
      const raw = await redis.get(`fb:session:${id}`);
      return raw ? JSON.parse(raw) : null;
    }
  } catch (error) {
    markRedisDown(error);
  }
  const entry = memorySessions.get(id);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    memorySessions.delete(id);
    return null;
  }
  return entry.user;
}

export async function deleteSession(id) {
  const removed = await withRedis((redis) => redis.del(`fb:session:${id}`));
  if (!removed) memorySessions.delete(id);
}

/** One-time OAuth state plus its PKCE verifier, valid for 10 minutes and consumed on first use. */
export async function saveState(state, verifier) {
  const value = typeof verifier === 'string' && verifier ? verifier : '1';
  const stored = await withRedis((redis) => redis.set(`fb:state:${state}`, value, 'EX', 600));
  if (stored) return;
  memorySessions.set(`state:${state}`, { verifier: value, expires: Date.now() + 600_000 });
}

export async function consumeState(state) {
  try {
    const redis = await getRedis();
    if (redis) {
      const value = await redis.get(`fb:state:${state}`);
      if (!value) return null;
      await redis.del(`fb:state:${state}`);
      return value;
    }
  } catch (error) {
    markRedisDown(error);
  }
  const entry = memorySessions.get(`state:${state}`);
  memorySessions.delete(`state:${state}`);
  if (!entry || entry.expires < Date.now()) return null;
  return entry.verifier || null;
}

function rememberLogin(entry) {
  memoryLogins.unshift(entry);
  memoryLogins.length = Math.min(memoryLogins.length, 200);
}

export async function recordLogin(user, ip) {
  const entry = { guid: user.guid, nickname: user.nickname, avatar: user.avatar ?? null, ip: ip ?? null, createdAt: new Date().toISOString() };
  try {
    const pool = await getPostgres();
    if (pool) {
      await pool.query('INSERT INTO logins (guid, nickname, avatar, ip) VALUES ($1, $2, $3, $4)', [
        entry.guid,
        entry.nickname,
        entry.avatar,
        entry.ip,
      ]);
      return;
    }
  } catch (error) {
    markPostgresDown(error);
  }
  rememberLogin(entry);
}

export async function recentLogins(limit = 50) {
  try {
    const pool = await getPostgres();
    if (pool) {
      const { rows } = await pool.query(
        'SELECT guid, nickname, avatar, ip, created_at AS "createdAt" FROM logins ORDER BY id DESC LIMIT $1',
        [limit]
      );
      return rows;
    }
  } catch (error) {
    markPostgresDown(error);
  }
  return memoryLogins.slice(0, limit);
}

export async function storageStatus() {
  return {
    sessions: process.env.REDIS_URL ? 'redis' : 'memory',
    logins: process.env.DATABASE_URL ? 'postgres' : 'memory',
  };
}

/** Continuous UTC days, with empty days as zero, so the admin chart does not skip quiet dates. */
export function fillDailyCounts(rows, days, now = new Date()) {
  const span = Math.min(90, Math.max(1, Number(days) || 30));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const keys = [];
  for (let i = span - 1; i >= 0; i -= 1) {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - i);
    keys.push(day.toISOString().slice(0, 10));
  }
  const byDay = new Map();
  for (const row of rows || []) {
    const day = String(row.day || '').slice(0, 10);
    if (!day) continue;
    byDay.set(day, {
      count: Math.max(0, Number(row.count) || 0),
      players: Math.max(0, Number(row.players) || 0),
    });
  }
  return keys.map((day) => ({
    day,
    count: byDay.get(day)?.count ?? 0,
    players: byDay.get(day)?.players ?? 0,
  }));
}

function activityFromEntries(entries, days) {
  const grouped = new Map();
  for (const entry of entries) {
    const created = new Date(entry.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const day = created.toISOString().slice(0, 10);
    const bucket = grouped.get(day) || { day, count: 0, guids: new Set() };
    bucket.count += 1;
    if (entry.guid) bucket.guids.add(entry.guid);
    grouped.set(day, bucket);
  }
  const series = fillDailyCounts(
    [...grouped.values()].map((bucket) => ({ day: bucket.day, count: bucket.count, players: bucket.guids.size })),
    days
  );
  const inRange = series.reduce((sum, point) => sum + point.count, 0);
  const unique = new Set(
    entries
      .filter((entry) => series.some((point) => point.day === String(entry.createdAt).slice(0, 10)))
      .map((entry) => entry.guid)
      .filter(Boolean)
  ).size;
  return { days: series.length, total: entries.length, inRange, unique, series };
}

/** Login counts per day for the admin charts. Postgres when it is configured, otherwise the in-memory list. */
export async function loginActivity(days = 30) {
  const span = Math.min(90, Math.max(1, Number(days) || 30));
  try {
    const pool = await getPostgres();
    if (pool) {
      const { rows } = await pool.query(
        `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS count,
                COUNT(DISTINCT guid)::int AS players
         FROM logins
         WHERE created_at >= NOW() - make_interval(days => $1)
         GROUP BY 1
         ORDER BY 1`,
        [span]
      );
      const totals = await pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE created_at >= NOW() - make_interval(days => $1))::int AS in_range,
                COUNT(DISTINCT guid) FILTER (WHERE created_at >= NOW() - make_interval(days => $1))::int AS unique_players
         FROM logins`,
        [span]
      );
      const row = totals.rows[0] || {};
      return {
        days: span,
        total: Number(row.total) || 0,
        inRange: Number(row.in_range) || 0,
        unique: Number(row.unique_players) || 0,
        series: fillDailyCounts(rows, span),
      };
    }
  } catch (error) {
    markPostgresDown(error);
  }
  return activityFromEntries(memoryLogins, span);
}
