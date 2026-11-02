/**
 * Storage for login sessions (Redis) and the login history (PostgreSQL).
 * Both are optional: without REDIS_URL / DATABASE_URL the data lives in memory,
 * which is enough for local development but is lost on restart.
 */
import { fail, once } from './log.mjs';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const memorySessions = new Map();
const memoryLogins = [];
const memoryOnline = [];
const memoryVerified = new Set();
const memoryKick = new Map();
const memoryTwitch = new Map();
const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const KICK_NAME = /^[A-Za-z0-9_-]{3,25}$/;
export const TWITCH_NAME = /^[A-Za-z0-9_]{3,25}$/;

let redisPromise;
let postgresPromise;
let redisDownUntil = 0;
let postgresDownUntil = 0;

function markRedisDown(error) {
  if (once('redis-down', 60_000)) fail('store', `redis unavailable, sessions stay in memory (${error?.message || error})`);
  redisDownUntil = Date.now() + 15_000;
  redisPromise = undefined;
}

function markPostgresDown(error) {
  if (once('postgres-down', 60_000)) fail('store', `postgres unavailable, login history stays in memory (${error?.message || error})`);
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
        CREATE TABLE IF NOT EXISTS verified_accounts (
          guid VARCHAR(64) PRIMARY KEY,
          verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        INSERT INTO verified_accounts (guid)
        SELECT DISTINCT lower(guid) FROM logins
        WHERE guid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ON CONFLICT (guid) DO NOTHING;
        CREATE TABLE IF NOT EXISTS online_samples (
          bucket TIMESTAMPTZ PRIMARY KEY,
          online INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_kick (
          guid VARCHAR(64) PRIMARY KEY,
          kick VARCHAR(25) NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS user_kick_login ON user_kick (lower(kick));
        CREATE TABLE IF NOT EXISTS user_twitch (
          guid VARCHAR(64) PRIMARY KEY,
          twitch VARCHAR(25) NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS user_twitch_login ON user_twitch (lower(twitch));
      `);
      return pool;
    })
    .catch((error) => {
      markPostgresDown(error);
      return null;
    });
  return postgresPromise;
}

export async function withRedis(run) {
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

/** Runs a Redis command and returns its value. `undefined` when Redis is down. */
export async function redisCall(run) {
  try {
    const redis = await getRedis();
    if (!redis) return undefined;
    return await run(redis);
  } catch (error) {
    markRedisDown(error);
    return undefined;
  }
}

/** Runs a query on the login Postgres pool. `undefined` when Postgres is down. */
export async function postgresCall(run) {
  try {
    const pool = await getPostgres();
    if (!pool) return undefined;
    return await run(pool);
  } catch (error) {
    markPostgresDown(error);
    return undefined;
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
      await markVerified(entry.guid);
      return;
    }
  } catch (error) {
    markPostgresDown(error);
  }
  rememberLogin(entry);
  await markVerified(entry.guid);
}

/** Remembers that this FACEIT account signed in. The public board only learns a yes or no later. */
export async function markVerified(guid) {
  const id = String(guid || '').trim().toLowerCase();
  if (!ACCOUNT_ID.test(id)) return;
  memoryVerified.add(id);
  await postgresCall((pool) =>
    pool.query('INSERT INTO verified_accounts (guid) VALUES ($1) ON CONFLICT (guid) DO NOTHING', [id])
  );
}

/** Which of these account ids have signed in. Anything else from the login row stays in the database. */
export async function verifiedAmong(guids) {
  const wanted = [...new Set(guids.map((guid) => String(guid || '').trim().toLowerCase()).filter((id) => ACCOUNT_ID.test(id)))];
  const found = new Set();
  for (const id of wanted) if (memoryVerified.has(id)) found.add(id);
  if (wanted.length === 0) return found;
  const result = await postgresCall((pool) =>
    pool.query('SELECT guid FROM verified_accounts WHERE guid = ANY($1::text[])', [wanted])
  );
  for (const row of result?.rows ?? []) found.add(String(row.guid).toLowerCase());
  return found;
}

/** A Kick channel name as Kick itself accepts it; empty when the value is not a channel. */
export function cleanKick(value) {
  if (typeof value !== 'string') return '';
  const kick = value.trim();
  return KICK_NAME.test(kick) ? kick : '';
}

/** The Kick login stored for this FACEIT account, or null. */
export async function kickForUser(guid) {
  const id = String(guid || '').trim().toLowerCase();
  if (!ACCOUNT_ID.test(id)) return null;
  const result = await postgresCall((pool) =>
    pool.query('SELECT kick FROM user_kick WHERE guid = $1', [id])
  );
  if (result?.rows[0]?.kick) {
    const kick = cleanKick(result.rows[0].kick);
    if (kick) {
      memoryKick.set(id, kick);
      return kick;
    }
  }
  return memoryKick.get(id) || null;
}

/**
 * Store or clear a Kick login that OAuth already verified. The same channel cannot sit on two accounts.
 * `{ ok: false, error }` is `invalid` or `taken`. Callers must not pass a typed nick from the profile form.
 */
export async function setKick(guid, raw) {
  const id = String(guid || '').trim().toLowerCase();
  if (!ACCOUNT_ID.test(id)) return { ok: false, error: 'invalid' };
  if (raw === null || raw === '') {
    memoryKick.delete(id);
    await postgresCall((pool) => pool.query('DELETE FROM user_kick WHERE guid = $1', [id]));
    return { ok: true, kick: null };
  }
  const kick = cleanKick(raw);
  if (!kick) return { ok: false, error: 'invalid' };
  for (const [other, name] of memoryKick) {
    if (other !== id && String(name).toLowerCase() === kick.toLowerCase()) return { ok: false, error: 'taken' };
  }
  const saved = await postgresCall(async (pool) => {
    try {
      await pool.query(
        `INSERT INTO user_kick (guid, kick) VALUES ($1, $2)
         ON CONFLICT (guid) DO UPDATE SET kick = EXCLUDED.kick, updated_at = NOW()`,
        [id, kick]
      );
      return { kick };
    } catch (error) {
      if (error?.code === '23505') return { error: 'taken' };
      throw error;
    }
  });
  if (saved?.error === 'taken') return { ok: false, error: 'taken' };
  memoryKick.set(id, saved?.kick ?? kick);
  return { ok: true, kick: saved?.kick ?? kick };
}

/** Kick logins stored for these FACEIT ids. */
export async function kicksAmong(guids) {
  const wanted = [...new Set(guids.map((guid) => String(guid || '').trim().toLowerCase()).filter((id) => ACCOUNT_ID.test(id)))];
  const found = new Map();
  for (const id of wanted) {
    const kick = memoryKick.get(id);
    if (kick) found.set(id, kick);
  }
  if (wanted.length === 0) return found;
  const result = await postgresCall((pool) =>
    pool.query('SELECT guid, kick FROM user_kick WHERE guid = ANY($1::text[])', [wanted])
  );
  for (const row of result?.rows ?? []) {
    const kick = cleanKick(row.kick);
    if (!kick) continue;
    const id = String(row.guid).toLowerCase();
    memoryKick.set(id, kick);
    found.set(id, kick);
  }
  return found;
}

/** A Twitch login as Twitch itself accepts it; empty when the value is not a channel. */
export function cleanTwitch(value) {
  if (typeof value !== 'string') return '';
  const twitch = value.trim();
  return TWITCH_NAME.test(twitch) ? twitch : '';
}

/** The Twitch login stored for this FACEIT account, or null. */
export async function twitchForUser(guid) {
  const id = String(guid || '').trim().toLowerCase();
  if (!ACCOUNT_ID.test(id)) return null;
  const result = await postgresCall((pool) =>
    pool.query('SELECT twitch FROM user_twitch WHERE guid = $1', [id])
  );
  if (result?.rows[0]?.twitch) {
    const twitch = cleanTwitch(result.rows[0].twitch);
    if (twitch) {
      memoryTwitch.set(id, twitch);
      return twitch;
    }
  }
  return memoryTwitch.get(id) || null;
}

/**
 * Store or clear a Twitch login that OAuth already verified. The same channel cannot sit on two accounts.
 * `{ ok: false, error }` is `invalid` or `taken`. Callers must not pass a typed nick from the profile form.
 */
export async function setTwitch(guid, raw) {
  const id = String(guid || '').trim().toLowerCase();
  if (!ACCOUNT_ID.test(id)) return { ok: false, error: 'invalid' };
  if (raw === null || raw === '') {
    memoryTwitch.delete(id);
    await postgresCall((pool) => pool.query('DELETE FROM user_twitch WHERE guid = $1', [id]));
    return { ok: true, twitch: null };
  }
  const twitch = cleanTwitch(raw);
  if (!twitch) return { ok: false, error: 'invalid' };
  for (const [other, name] of memoryTwitch) {
    if (other !== id && String(name).toLowerCase() === twitch.toLowerCase()) return { ok: false, error: 'taken' };
  }
  const saved = await postgresCall(async (pool) => {
    try {
      await pool.query(
        `INSERT INTO user_twitch (guid, twitch) VALUES ($1, $2)
         ON CONFLICT (guid) DO UPDATE SET twitch = EXCLUDED.twitch, updated_at = NOW()`,
        [id, twitch]
      );
      return { twitch };
    } catch (error) {
      if (error?.code === '23505') return { error: 'taken' };
      throw error;
    }
  });
  if (saved?.error === 'taken') return { ok: false, error: 'taken' };
  memoryTwitch.set(id, saved?.twitch ?? twitch);
  return { ok: true, twitch: saved?.twitch ?? twitch };
}

/** Twitch logins stored for these FACEIT ids. */
export async function twitchesAmong(guids) {
  const wanted = [...new Set(guids.map((guid) => String(guid || '').trim().toLowerCase()).filter((id) => ACCOUNT_ID.test(id)))];
  const found = new Map();
  for (const id of wanted) {
    const twitch = memoryTwitch.get(id);
    if (twitch) found.set(id, twitch);
  }
  if (wanted.length === 0) return found;
  const result = await postgresCall((pool) =>
    pool.query('SELECT guid, twitch FROM user_twitch WHERE guid = ANY($1::text[])', [wanted])
  );
  for (const row of result?.rows ?? []) {
    const twitch = cleanTwitch(row.twitch);
    if (!twitch) continue;
    const id = String(row.guid).toLowerCase();
    memoryTwitch.set(id, twitch);
    found.set(id, twitch);
  }
  return found;
}

/** This account's own studio sign-ins. The address stays in the database and is not returned. */
export async function loginsForUser(guid, limit = 8) {
  const cap = Math.min(20, Math.max(1, Number(limit) || 8));
  try {
    const pool = await getPostgres();
    if (pool) {
      const { rows } = await pool.query(
        'SELECT created_at AS "createdAt" FROM logins WHERE guid = $1 ORDER BY id DESC LIMIT $2',
        [guid, cap]
      );
      return rows;
    }
  } catch (error) {
    markPostgresDown(error);
  }
  return memoryLogins.filter((entry) => entry.guid === guid).slice(0, cap).map(({ createdAt }) => ({ createdAt }));
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

const HOUR_MS = 60 * 60 * 1000;
const ONLINE_KEEP_HOURS = 24 * 90;

function hourBucket(at) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function rememberOnline(bucket, online) {
  const index = memoryOnline.findIndex((row) => row.bucket === bucket);
  if (index >= 0) memoryOnline[index].online = Math.max(memoryOnline[index].online, online);
  else memoryOnline.push({ bucket, online });
  const cutoff = Date.now() - ONLINE_KEEP_HOURS * HOUR_MS;
  for (let i = memoryOnline.length - 1; i >= 0; i -= 1) {
    if (Date.parse(memoryOnline[i].bucket) < cutoff) memoryOnline.splice(i, 1);
  }
}

/** One count for this UTC hour: the highest number of open banners seen in it. */
export async function recordOnlineSample(online, at = new Date()) {
  const bucket = hourBucket(at);
  if (!bucket) return;
  const count = Math.max(0, Math.min(1_000_000, Math.round(Number(online) || 0)));
  const saved = await postgresCall(async (pool) => {
    await pool.query(
      `INSERT INTO online_samples (bucket, online) VALUES ($1, $2)
       ON CONFLICT (bucket) DO UPDATE SET online = GREATEST(online_samples.online, EXCLUDED.online)`,
      [bucket, count]
    );
    await pool.query(`DELETE FROM online_samples WHERE bucket < NOW() - INTERVAL '90 days'`);
    return true;
  });
  if (saved === undefined) rememberOnline(bucket, count);
}

/** Hourly online counts. Hours before the first saved sample are left out; a missed hour is zero. */
export function fillHourlyCounts(rows, hours, now = new Date()) {
  const span = Math.min(ONLINE_KEEP_HOURS, Math.max(1, Number(hours) || 1));
  const end = hourBucket(now);
  if (!end) return [];
  const endMs = Date.parse(end);
  const byHour = new Map();
  for (const row of rows || []) {
    const key = hourBucket(row.bucket);
    if (!key) continue;
    byHour.set(key, Math.max(0, Number(row.online) || 0));
  }
  const series = [];
  for (let i = span - 1; i >= 0; i -= 1) {
    const key = new Date(endMs - i * HOUR_MS).toISOString();
    series.push({ hour: key, online: byHour.get(key) ?? 0 });
  }
  const first = series.findIndex((point) => byHour.has(point.hour));
  return first < 0 ? [] : series.slice(first);
}

export async function onlineHistory(hours = 24 * 30, now = new Date()) {
  const span = Math.min(ONLINE_KEEP_HOURS, Math.max(1, Number(hours) || 24 * 30));
  const result = await postgresCall((pool) =>
    pool.query(
      `SELECT bucket, online FROM online_samples
       WHERE bucket >= NOW() - make_interval(hours => $1::int)
       ORDER BY bucket`,
      [span]
    )
  );
  const rows = result === undefined ? memoryOnline : result.rows;
  return { hours: span, series: fillHourlyCounts(rows, span, now) };
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
