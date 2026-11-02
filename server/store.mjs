/**
 * Storage for login sessions (Redis), the login history (PostgreSQL), and per-player
 * FACEIT snapshots. Redis is the hot copy; Postgres keeps a warm copy so a deploy
 * does not empty stats. Both URLs are optional: without them the data lives in memory,
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
        CREATE TABLE IF NOT EXISTS faceit_profiles (
          guid VARCHAR(64) PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_faceit_profiles_updated ON faceit_profiles (updated_at);
        CREATE TABLE IF NOT EXISTS streamer_identities (
          slug VARCHAR(32) PRIMARY KEY,
          canonical VARCHAR(32) NOT NULL,
          platform VARCHAR(8) NOT NULL,
          login VARCHAR(25) NOT NULL,
          guid VARCHAR(64),
          nickname VARCHAR(64),
          avatar VARCHAR(255),
          twitch VARCHAR(25),
          kick VARCHAR(25),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_streamer_identities_canonical ON streamer_identities (canonical);
        CREATE TABLE IF NOT EXISTS streamer_daily (
          slug VARCHAR(32) NOT NULL,
          day DATE NOT NULL,
          platform VARCHAR(8) NOT NULL,
          login VARCHAR(25) NOT NULL,
          guid VARCHAR(64),
          nickname VARCHAR(64),
          avatar VARCHAR(255),
          twitch VARCHAR(25),
          kick VARCHAR(25),
          viewers_peak INTEGER NOT NULL DEFAULT 0,
          viewers_sum BIGINT NOT NULL DEFAULT 0,
          viewers_samples INTEGER NOT NULL DEFAULT 0,
          elo INTEGER,
          matches INTEGER NOT NULL DEFAULT 0,
          last_match_id VARCHAR(64),
          PRIMARY KEY (slug, day)
        );
        CREATE INDEX IF NOT EXISTS idx_streamer_daily_day ON streamer_daily (day DESC);
        CREATE TABLE IF NOT EXISTS streamer_samples (
          slug VARCHAR(32) NOT NULL,
          ts TIMESTAMPTZ NOT NULL,
          elo INTEGER,
          viewers INTEGER,
          match_id VARCHAR(64),
          PRIMARY KEY (slug, ts)
        );
        CREATE INDEX IF NOT EXISTS idx_streamer_samples_slug_ts ON streamer_samples (slug, ts DESC);
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

const SESSION_COOKIE = 'fb_session';
const SESSION_COOKIE_ID = /^[a-f0-9]{48}$/;
const studioUsers = new Map();
let studioHydrated = false;
let studioHydrating = null;

function studioGuid(user) {
  const guid = String(user?.guid || '').trim();
  return guid ? guid.toLowerCase() : '';
}

function pruneStudioUsers(now = Date.now()) {
  for (const [key, entry] of studioUsers) {
    if (entry.expires < now) studioUsers.delete(key);
  }
}

/** Remembers a signed-in FACEIT account so a matching live row can get the confirmed badge. */
export function rememberStudioUser(user, expires = Date.now() + SESSION_TTL_SECONDS * 1000) {
  const guid = studioGuid(user);
  const nickname = typeof user?.nickname === 'string' ? user.nickname.trim() : '';
  if (!guid || !nickname) return;
  studioUsers.set(guid, {
    guid,
    nickname,
    avatar: user.avatar ?? null,
    expires,
  });
}

export function forgetStudioUser(guid) {
  const key = studioGuid({ guid });
  if (key) studioUsers.delete(key);
}

export function resetStudioUsersForTests() {
  studioUsers.clear();
  studioHydrated = false;
  studioHydrating = null;
}

function takeSessionUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const guid = studioGuid(raw);
  const nickname = typeof raw.nickname === 'string' ? raw.nickname.trim() : '';
  if (!guid || !nickname) return null;
  return { guid, nickname, avatar: raw.avatar ?? null };
}

async function readSession(id) {
  try {
    const redis = await getRedis();
    if (redis) {
      const raw = await redis.get(`fb:session:${id}`);
      if (!raw) return null;
      try {
        return takeSessionUser(JSON.parse(raw));
      } catch {
        return null;
      }
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
  return takeSessionUser(entry.user);
}

async function loadStudioUsers() {
  await withRedis(async (redis) => {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'fb:session:*', 'COUNT', 200);
      cursor = String(next);
      if (!keys?.length) continue;
      const values = await redis.mget(...keys);
      for (const raw of values) {
        if (!raw) continue;
        try {
          rememberStudioUser(JSON.parse(raw));
        } catch {
          /* a broken session row is skipped */
        }
      }
    } while (cursor !== '0');
  });
  const now = Date.now();
  for (const [id, entry] of memorySessions) {
    if (id.startsWith('state:') || !entry?.user || entry.expires < now) continue;
    rememberStudioUser(entry.user, entry.expires);
  }
  studioHydrated = true;
}

export async function hydrateStudioUsers() {
  if (studioHydrated) return;
  studioHydrating ??= loadStudioUsers().finally(() => {
    studioHydrating = null;
  });
  return studioHydrating;
}

/** Unique FACEIT (or local Dev Admin) accounts that still have a studio session. */
export async function listStudioUsers() {
  await hydrateStudioUsers();
  pruneStudioUsers();
  return [...studioUsers.values()].map(({ guid, nickname, avatar }) => ({ guid, nickname, avatar }));
}

export function getStudioUsersSync() {
  pruneStudioUsers();
  return [...studioUsers.values()].map(({ guid, nickname, avatar }) => ({ guid, nickname, avatar }));
}

function sessionIdFromCookie(header = '') {
  for (const part of String(header).split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== SESSION_COOKIE) continue;
    try {
      const id = decodeURIComponent(rest.join('='));
      return SESSION_COOKIE_ID.test(id) ? id : '';
    } catch {
      return '';
    }
  }
  return '';
}

/** Remembers this request's studio cookie so a matching FACEIT live row can be marked confirmed. */
export async function touchStudioSession(cookieHeader) {
  const id = sessionIdFromCookie(cookieHeader);
  if (!id) return null;
  const user = await readSession(id);
  if (user) rememberStudioUser(user);
  return user;
}

export async function saveSession(id, user) {
  rememberStudioUser(user);
  const stored = await withRedis((redis) =>
    redis.set(`fb:session:${id}`, JSON.stringify(user), 'EX', SESSION_TTL_SECONDS)
  );
  if (stored) return;
  memorySessions.set(id, { user, expires: Date.now() + SESSION_TTL_SECONDS * 1000 });
}

export async function loadSession(id) {
  const user = await readSession(id);
  if (user) rememberStudioUser(user);
  return user;
}

export async function deleteSession(id) {
  const user = await readSession(id);
  const removed = await withRedis((redis) => redis.del(`fb:session:${id}`));
  if (!removed) memorySessions.delete(id);
  if (user) {
    forgetStudioUser(user.guid);
    studioHydrated = false;
  }
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

export const FACEIT_PROFILE_PREFIX = 'fb:profile:';
export const FACEIT_ANSWERS_PREFIX = 'fb:fapi:';
export const FACEIT_PROFILE_TTL_SECONDS = 24 * 60 * 60;

/** Deletes every Redis key with this prefix, a page at a time. */
export async function deleteRedisPrefix(prefix) {
  await redisCall(async (redis) => {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  });
}

function parseAnswers(raw) {
  if (!raw) return null;
  try {
    const answers = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : null;
  } catch {
    return null;
  }
}

/** Redis/Postgres row: { profile, at, answers }. Older rows that only have a live snapshot still parse. */
export function parseFaceitProfile(raw) {
  if (!raw) return null;
  try {
    const entry = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!entry || typeof entry !== 'object') return null;
    const at = Number(entry.at);
    const profile = entry.profile && typeof entry.profile === 'object' ? entry.profile : null;
    const answers = parseAnswers(entry.answers);
    if (!profile && !answers) return null;
    return {
      at: Number.isFinite(at) ? at : 0,
      ...(profile ? { profile } : {}),
      ...(answers ? { answers } : {}),
    };
  } catch {
    return null;
  }
}

/** Shallow profile replace, answers merged by cache key. */
export function mergeFaceitPayload(current, patch) {
  const answers = { ...(current?.answers || {}), ...(patch?.answers || {}) };
  const at = Number.isFinite(patch?.at) ? patch.at : Number.isFinite(current?.at) ? current.at : Date.now();
  const profile = patch?.profile ?? current?.profile;
  return {
    at,
    ...(profile ? { profile } : {}),
    ...(Object.keys(answers).length ? { answers } : {}),
  };
}

/** Newest finished match from a history body: what the banner uses to decide whether stats changed. */
export function lastMatchFromHistory(body) {
  try {
    const item = JSON.parse(body)?.items?.[0];
    if (!item || typeof item.match_id !== 'string' || !item.match_id) return null;
    const summary = { matchId: item.match_id };
    if (Number.isFinite(Number(item.started_at))) summary.startedAt = Number(item.started_at);
    if (Number.isFinite(Number(item.finished_at))) summary.finishedAt = Number(item.finished_at);
    if (item.game === 'cs2') summary.game = 'cs2';
    return summary;
  } catch {
    return null;
  }
}

async function promoteFaceitProfile(id, payload) {
  if (payload?.profile && Number.isFinite(payload.at)) {
    await redisCall((redis) =>
      redis.set(
        `${FACEIT_PROFILE_PREFIX}${id}`,
        JSON.stringify({ profile: payload.profile, at: payload.at }),
        'EX',
        FACEIT_PROFILE_TTL_SECONDS
      )
    );
  }
  if (payload?.answers && Object.keys(payload.answers).length) {
    await redisCall((redis) =>
      redis.set(`${FACEIT_ANSWERS_PREFIX}${id}`, JSON.stringify(payload.answers), 'EX', FACEIT_PROFILE_TTL_SECONDS)
    );
  }
}

/** Hot Redis first, then Postgres. A warm hit is copied back to Redis. */
export async function loadFaceitProfile(id) {
  const key = String(id || '').toLowerCase();
  if (!ACCOUNT_ID.test(key)) return null;
  const hot = parseFaceitProfile(await redisCall((redis) => redis.get(`${FACEIT_PROFILE_PREFIX}${key}`)));
  const hotAnswers = parseAnswers(await redisCall((redis) => redis.get(`${FACEIT_ANSWERS_PREFIX}${key}`)));
  if (hot?.profile || hotAnswers) {
    let answers = { ...(hot?.answers || {}), ...(hotAnswers || {}) };
    if (!Object.keys(answers).length) {
      const warm = await postgresCall((pool) => pool.query('SELECT payload FROM faceit_profiles WHERE guid = $1', [key]));
      const parsed = parseFaceitProfile(warm?.rows?.[0]?.payload);
      if (parsed?.answers) {
        answers = { ...parsed.answers, ...answers };
        void promoteFaceitProfile(key, { ...hot, answers });
      }
    }
    return {
      at: hot?.at ?? 0,
      ...(hot?.profile ? { profile: hot.profile } : {}),
      ...(Object.keys(answers).length ? { answers } : {}),
    };
  }
  const warm = await postgresCall((pool) => pool.query('SELECT payload FROM faceit_profiles WHERE guid = $1', [key]));
  const parsed = parseFaceitProfile(warm?.rows?.[0]?.payload);
  if (!parsed) return null;
  void promoteFaceitProfile(key, parsed);
  return parsed;
}

export async function loadFaceitProfiles(ids) {
  const wanted = [...new Set(ids.map((id) => String(id || '').toLowerCase()).filter((id) => ACCOUNT_ID.test(id)))];
  const found = new Map();
  if (!wanted.length) return found;
  const rows = await redisCall((redis) => redis.mget(wanted.map((id) => `${FACEIT_PROFILE_PREFIX}${id}`)));
  const missing = [];
  wanted.forEach((id, index) => {
    const entry = parseFaceitProfile(rows?.[index]);
    if (entry?.profile && Number.isFinite(entry.at)) found.set(id, entry);
    else missing.push(id);
  });
  if (!missing.length) return found;
  const warm = await postgresCall((pool) =>
    pool.query('SELECT guid, payload FROM faceit_profiles WHERE guid = ANY($1::text[])', [missing])
  );
  for (const row of warm?.rows ?? []) {
    const entry = parseFaceitProfile(row.payload);
    if (!entry?.profile) continue;
    const id = String(row.guid).toLowerCase();
    found.set(id, entry);
    void promoteFaceitProfile(id, entry);
  }
  return found;
}

export async function loadFaceitAnswer(id, cacheKey) {
  const row = await loadFaceitProfile(id);
  return row?.answers?.[cacheKey] ?? null;
}

export async function saveFaceitProfile(id, patch) {
  const key = String(id || '').toLowerCase();
  if (!ACCOUNT_ID.test(key) || !patch || typeof patch !== 'object') return false;
  const current = (await loadFaceitProfile(key)) || {};
  let next = mergeFaceitPayload(current, patch);
  if (patch.answers && next.profile) {
    for (const [answerKey, entry] of Object.entries(patch.answers)) {
      if (entry?.status === 200 && /\/history\?/i.test(answerKey) && typeof entry.body === 'string') {
        const lastMatch = lastMatchFromHistory(entry.body);
        if (lastMatch) next = { ...next, profile: { ...next.profile, lastMatch } };
      }
    }
  }
  await promoteFaceitProfile(key, next);
  await postgresCall((pool) =>
    pool.query(
      `INSERT INTO faceit_profiles (guid, payload) VALUES ($1, $2::jsonb)
       ON CONFLICT (guid) DO UPDATE SET
         payload = jsonb_build_object(
           'at', COALESCE(EXCLUDED.payload->'at', faceit_profiles.payload->'at'),
           'profile', COALESCE(EXCLUDED.payload->'profile', faceit_profiles.payload->'profile'),
           'answers', COALESCE(faceit_profiles.payload->'answers', '{}'::jsonb) || COALESCE(EXCLUDED.payload->'answers', '{}'::jsonb)
         ),
         updated_at = NOW()`,
      [key, JSON.stringify(next)]
    )
  );
  if (once('faceit-profile-prune', 60_000)) {
    await postgresCall((pool) => pool.query(`DELETE FROM faceit_profiles WHERE updated_at < NOW() - INTERVAL '14 days'`));
  }
  return true;
}

export async function saveFaceitAnswer(id, cacheKey, entry) {
  if (!cacheKey || entry?.status !== 200 || typeof entry.body !== 'string') return false;
  return saveFaceitProfile(id, {
    answers: {
      [cacheKey]: {
        status: entry.status,
        body: entry.body,
        at: entry.at,
        fetchedAt: entry.fetchedAt ?? entry.at,
        head: entry.head ?? null,
      },
    },
  });
}

export async function removeFaceitProfile(id) {
  const key = String(id || '').toLowerCase();
  if (!ACCOUNT_ID.test(key)) return false;
  await redisCall((redis) => redis.del(`${FACEIT_PROFILE_PREFIX}${key}`, `${FACEIT_ANSWERS_PREFIX}${key}`));
  await postgresCall((pool) => pool.query('DELETE FROM faceit_profiles WHERE guid = $1', [key]));
  return true;
}

export async function clearFaceitProfileSnapshots() {
  await deleteRedisPrefix(FACEIT_PROFILE_PREFIX);
  await postgresCall((pool) => pool.query(`UPDATE faceit_profiles SET payload = payload - 'profile', updated_at = NOW()`));
}

export async function clearFaceitAnswers() {
  await deleteRedisPrefix(FACEIT_ANSWERS_PREFIX);
  await postgresCall((pool) =>
    pool.query(
      `UPDATE faceit_profiles SET payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{answers}', '{}'::jsonb), updated_at = NOW()`
    )
  );
}

export async function removeFaceitAnswers(id) {
  const key = String(id || '').toLowerCase();
  if (!ACCOUNT_ID.test(key)) return false;
  await redisCall((redis) => redis.del(`${FACEIT_ANSWERS_PREFIX}${key}`));
  await postgresCall((pool) =>
    pool.query(
      `UPDATE faceit_profiles SET payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{answers}', '{}'::jsonb), updated_at = NOW() WHERE guid = $1`,
      [key]
    )
  );
  return true;
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

const STREAMER_SLUG = /^[A-Za-z0-9_-]{3,25}$/;
export const STREAMER_KEEP_DAYS = 90;
export const STREAMER_SESSION_GAP_MS = 45 * 60 * 1000;
const memoryStreamerDaily = new Map();
const memoryStreamerIdentities = new Map();
const memoryStreamerSamples = new Map();

/** UTC calendar day `YYYY-MM-DD`. */
export function utcDay(at = new Date()) {
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/** Canonical slug: Twitch login when present, otherwise Kick. */
export function streamerSlugFrom(player) {
  const twitch = cleanTwitch(player?.twitch);
  if (twitch) return twitch.toLowerCase();
  const kick = cleanKick(player?.kick);
  return kick ? kick.toLowerCase() : '';
}

function dailyKey(slug, day) {
  return `${slug}|${day}`;
}

function asInt(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

/** Continuous UTC days so a quiet date still has a row (peak/avg/matches at zero). */
export function fillStreamerDays(rows, days, now = new Date()) {
  const span = Math.min(STREAMER_KEEP_DAYS, Math.max(1, Number(days) || 7));
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
    const samples = asInt(row.viewersSamples ?? row.viewers_samples);
    const avg = Number.isFinite(Number(row.viewersAvg ?? row.viewers_avg))
      ? asInt(row.viewersAvg ?? row.viewers_avg)
      : samples
        ? Math.round(asInt(row.viewersSum ?? row.viewers_sum) / samples)
        : 0;
    const eloRaw = row.elo;
    byDay.set(day, {
      day,
      viewersPeak: asInt(row.viewersPeak ?? row.viewers_peak),
      viewersAvg: avg,
      viewersSamples: samples,
      elo: Number.isInteger(Number(eloRaw)) ? Number(eloRaw) : null,
      matches: asInt(row.matches),
    });
  }
  return keys.map((day) => byDay.get(day) ?? { day, viewersPeak: 0, viewersAvg: 0, viewersSamples: 0, elo: null, matches: 0 });
}

export function summarizeStreamerDays(series) {
  let peak = 0;
  let weighted = 0;
  let samples = 0;
  let matches = 0;
  let elo = null;
  for (const point of series || []) {
    peak = Math.max(peak, asInt(point.viewersPeak));
    samples += asInt(point.viewersSamples);
    weighted += asInt(point.viewersAvg) * asInt(point.viewersSamples);
    matches += asInt(point.matches);
    if (point.elo != null) elo = Number(point.elo);
  }
  return {
    viewersPeak: peak,
    viewersAvg: samples ? Math.round(weighted / samples) : 0,
    matches,
    elo: Number.isInteger(elo) ? elo : null,
  };
}

function rememberIdentity(identity) {
  if (!identity?.slug) return;
  memoryStreamerIdentities.set(identity.slug, { ...memoryStreamerIdentities.get(identity.slug), ...identity });
}

function rememberDaily(row) {
  memoryStreamerDaily.set(dailyKey(row.slug, row.day), { ...row });
  const cutoff = utcDay(new Date(Date.now() - STREAMER_KEEP_DAYS * 24 * 60 * 60 * 1000));
  for (const [key, entry] of memoryStreamerDaily) {
    if (entry.day < cutoff) memoryStreamerDaily.delete(key);
  }
}

function samplePoint(row) {
  const ts = row instanceof Date ? row.getTime() : Number(row.ts);
  return {
    ts: Number.isFinite(ts) ? ts : 0,
    elo: Number.isInteger(Number(row.elo)) ? Number(row.elo) : null,
    viewers: Number.isInteger(Number(row.viewers)) ? Number(row.viewers) : null,
    matchId: typeof row.matchId === 'string' && row.matchId ? row.matchId : row.match_id || '',
  };
}

function rememberSample(slug, point) {
  if (!slug || !point?.ts) return;
  const list = memoryStreamerSamples.get(slug) || [];
  const next = samplePoint(point);
  const index = list.findIndex((row) => row.ts === next.ts);
  if (index >= 0) list[index] = { ...list[index], ...next };
  else list.push(next);
  const cutoff = Date.now() - STREAMER_KEEP_DAYS * 24 * 60 * 60 * 1000;
  memoryStreamerSamples.set(
    slug,
    list.filter((row) => row.ts >= cutoff).sort((a, b) => a.ts - b.ts)
  );
}

/** A gap longer than this between samples starts a new stream session. */
export function groupStreamerSessions(points, gapMs = STREAMER_SESSION_GAP_MS) {
  const sorted = [...(points || [])].filter((point) => Number.isFinite(Number(point?.ts))).sort((a, b) => a.ts - b.ts);
  const sessions = [];
  for (const raw of sorted) {
    const point = samplePoint(raw);
    const last = sessions[sessions.length - 1];
    if (!last || point.ts - last.endedAt > gapMs) {
      sessions.push({
        startedAt: point.ts,
        endedAt: point.ts,
        eloStart: point.elo,
        eloEnd: point.elo,
        viewersPeak: asInt(point.viewers),
        points: [point],
      });
      continue;
    }
    last.endedAt = point.ts;
    last.points.push(point);
    if (point.elo != null) {
      if (last.eloStart == null) last.eloStart = point.elo;
      last.eloEnd = point.elo;
    }
    last.viewersPeak = Math.max(last.viewersPeak, asInt(point.viewers));
  }
  return sessions.reverse();
}

export function downsamplePoints(points, max = 80) {
  const list = points || [];
  if (list.length <= max) return list;
  const out = [];
  const last = list.length - 1;
  for (let i = 0; i < max; i += 1) {
    const index = Math.round((i / (max - 1)) * last);
    if (!out.length || out[out.length - 1] !== list[index]) out.push(list[index]);
  }
  return out;
}

/** FACEIT id stored for this Twitch or Kick login (OAuth pairing first). */
export async function guidForChannel({ twitch, kick } = {}) {
  const twitchLogin = cleanTwitch(twitch);
  const kickLogin = cleanKick(kick);
  if (twitchLogin) {
    for (const [guid, name] of memoryTwitch) {
      if (String(name).toLowerCase() === twitchLogin.toLowerCase()) return guid;
    }
    const found = await postgresCall((pool) =>
      pool.query('SELECT guid FROM user_twitch WHERE lower(twitch) = lower($1)', [twitchLogin])
    );
    if (found?.rows[0]?.guid) return String(found.rows[0].guid).toLowerCase();
  }
  if (kickLogin) {
    for (const [guid, name] of memoryKick) {
      if (String(name).toLowerCase() === kickLogin.toLowerCase()) return guid;
    }
    const found = await postgresCall((pool) =>
      pool.query('SELECT guid FROM user_kick WHERE lower(kick) = lower($1)', [kickLogin])
    );
    if (found?.rows[0]?.guid) return String(found.rows[0].guid).toLowerCase();
  }
  return null;
}

/** Live samples only. Offline board rows (viewers 0 / live=false) must not enter rank math. */
export function isLiveStreamerSample(sample) {
  if (!sample || typeof sample !== 'object') return false;
  if (sample.live === false) return false;
  if (sample.live === true) return true;
  return Number.isInteger(sample.viewers) && sample.viewers > 0;
}

/**
 * Identity always; viewer/ELO/match rollups and time-series points only while live.
 * Offline 0s are not samples and must not pull the 7-day average down.
 */
export async function recordStreamerSample(sample, at = new Date()) {
  const slug = streamerSlugFrom(sample);
  if (!STREAMER_SLUG.test(slug)) return null;
  const day = utcDay(at);
  if (!day) return null;
  const twitch = cleanTwitch(sample.twitch) || null;
  const kick = cleanKick(sample.kick) || null;
  const platform = twitch ? 'twitch' : 'kick';
  const login = (twitch || kick || slug).slice(0, 25);
  const live = isLiveStreamerSample(sample);
  const viewers = live && Number.isInteger(sample.viewers) && sample.viewers >= 0 ? sample.viewers : null;
  const elo = Number.isInteger(sample.elo) && sample.elo >= 0 && sample.elo <= 10000 ? sample.elo : null;
  const matchId = typeof sample.matchId === 'string' && sample.matchId ? sample.matchId.slice(0, 64) : '';
  const guid = typeof sample.guid === 'string' && ACCOUNT_ID.test(sample.guid) ? sample.guid.toLowerCase() : '';
  const nickname = typeof sample.nickname === 'string' ? sample.nickname.trim().slice(0, 64) : '';
  const avatar = typeof sample.avatar === 'string' ? sample.avatar.slice(0, 255) : '';

  const identity = {
    slug,
    canonical: slug,
    platform,
    login,
    guid: guid || null,
    nickname: nickname || null,
    avatar: avatar || null,
    twitch,
    kick,
  };
  rememberIdentity(identity);
  if (kick && kick.toLowerCase() !== slug) {
    rememberIdentity({ ...identity, slug: kick.toLowerCase(), platform: 'kick', login: kick, canonical: slug });
  }

  const saved = await postgresCall(async (pool) => {
    await pool.query(
      `INSERT INTO streamer_identities (slug, canonical, platform, login, guid, nickname, avatar, twitch, kick)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (slug) DO UPDATE SET
         canonical = EXCLUDED.canonical,
         platform = EXCLUDED.platform,
         login = EXCLUDED.login,
         guid = COALESCE(EXCLUDED.guid, streamer_identities.guid),
         nickname = COALESCE(EXCLUDED.nickname, streamer_identities.nickname),
         avatar = COALESCE(EXCLUDED.avatar, streamer_identities.avatar),
         twitch = COALESCE(EXCLUDED.twitch, streamer_identities.twitch),
         kick = COALESCE(EXCLUDED.kick, streamer_identities.kick),
         updated_at = NOW()`,
      [slug, slug, platform, login, guid || null, nickname || null, avatar || null, twitch, kick]
    );
    if (kick && kick.toLowerCase() !== slug) {
      await pool.query(
        `INSERT INTO streamer_identities (slug, canonical, platform, login, guid, nickname, avatar, twitch, kick)
         VALUES ($1, $2, 'kick', $3, $4, $5, $6, $7, $8)
         ON CONFLICT (slug) DO UPDATE SET canonical = EXCLUDED.canonical, updated_at = NOW()`,
        [kick.toLowerCase(), slug, kick, guid || null, nickname || null, avatar || null, twitch, kick]
      );
    }
    if (!live) return true;
    await pool.query(
      `INSERT INTO streamer_daily (
         slug, day, platform, login, guid, nickname, avatar, twitch, kick,
         viewers_peak, viewers_sum, viewers_samples, elo, matches, last_match_id
       ) VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (slug, day) DO UPDATE SET
         platform = EXCLUDED.platform,
         login = EXCLUDED.login,
         guid = COALESCE(EXCLUDED.guid, streamer_daily.guid),
         nickname = COALESCE(EXCLUDED.nickname, streamer_daily.nickname),
         avatar = COALESCE(EXCLUDED.avatar, streamer_daily.avatar),
         twitch = COALESCE(EXCLUDED.twitch, streamer_daily.twitch),
         kick = COALESCE(EXCLUDED.kick, streamer_daily.kick),
         viewers_peak = GREATEST(streamer_daily.viewers_peak, EXCLUDED.viewers_peak),
         viewers_sum = streamer_daily.viewers_sum + EXCLUDED.viewers_sum,
         viewers_samples = streamer_daily.viewers_samples + EXCLUDED.viewers_samples,
         elo = COALESCE(EXCLUDED.elo, streamer_daily.elo),
         matches = streamer_daily.matches + CASE
           WHEN EXCLUDED.last_match_id IS NOT NULL
            AND EXCLUDED.last_match_id IS DISTINCT FROM streamer_daily.last_match_id
           THEN 1 ELSE 0 END,
         last_match_id = COALESCE(EXCLUDED.last_match_id, streamer_daily.last_match_id)`,
      [
        slug,
        day,
        platform,
        login,
        guid || null,
        nickname || null,
        avatar || null,
        twitch,
        kick,
        viewers ?? 0,
        viewers == null ? 0 : viewers,
        viewers == null ? 0 : 1,
        elo,
        matchId ? 1 : 0,
        matchId || null,
      ]
    );
    if (viewers != null) {
      await pool.query(
        `INSERT INTO streamer_samples (slug, ts, elo, viewers, match_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (slug, ts) DO UPDATE SET
           elo = COALESCE(EXCLUDED.elo, streamer_samples.elo),
           viewers = COALESCE(EXCLUDED.viewers, streamer_samples.viewers),
           match_id = COALESCE(EXCLUDED.match_id, streamer_samples.match_id)`,
        [slug, at, elo, viewers, matchId || null]
      );
    }
    if (once('streamer-daily-prune', 60_000)) {
      await pool.query(`DELETE FROM streamer_daily WHERE day < (NOW() AT TIME ZONE 'UTC')::date - 90`);
      await pool.query(`DELETE FROM streamer_samples WHERE ts < NOW() - INTERVAL '90 days'`);
    }
    return true;
  });

  if (saved === undefined && live) {
    const prev = memoryStreamerDaily.get(dailyKey(slug, day)) || {
      slug,
      day,
      platform,
      login,
      guid: guid || null,
      nickname,
      avatar,
      twitch,
      kick,
      viewersPeak: 0,
      viewersSum: 0,
      viewersSamples: 0,
      elo: null,
      matches: 0,
      lastMatchId: null,
    };
    if (viewers != null) {
      prev.viewersPeak = Math.max(prev.viewersPeak, viewers);
      prev.viewersSum += viewers;
      prev.viewersSamples += 1;
    }
    if (elo != null) prev.elo = elo;
    if (matchId && matchId !== prev.lastMatchId) {
      prev.matches += 1;
      prev.lastMatchId = matchId;
    }
    if (guid) prev.guid = guid;
    if (nickname) prev.nickname = nickname;
    if (avatar) prev.avatar = avatar;
    if (twitch) prev.twitch = twitch;
    if (kick) prev.kick = kick;
    rememberDaily(prev);
  }
  if (viewers != null) rememberSample(slug, { ts: at.getTime(), elo, viewers, matchId });
  return { slug, day };
}

export async function resolveStreamerCanonical(slug) {
  const key = String(slug || '').toLowerCase();
  if (!STREAMER_SLUG.test(key)) return '';
  const memory = memoryStreamerIdentities.get(key);
  if (memory?.canonical) return memory.canonical;
  const result = await postgresCall((pool) => pool.query('SELECT canonical FROM streamer_identities WHERE slug = $1', [key]));
  return result?.rows?.[0]?.canonical || key;
}

export async function streamerIdentity(slug) {
  const key = String(slug || '').toLowerCase();
  const canonical = (await resolveStreamerCanonical(key)) || key;
  const result = await postgresCall((pool) =>
    pool.query(
      'SELECT slug, canonical, platform, login, guid, nickname, avatar, twitch, kick FROM streamer_identities WHERE slug = $1',
      [canonical]
    )
  );
  if (result?.rows?.[0]) {
    rememberIdentity(result.rows[0]);
    return result.rows[0];
  }
  return memoryStreamerIdentities.get(canonical) || memoryStreamerIdentities.get(key) || null;
}

export async function streamerDailySeries(slug, days = 7, now = new Date()) {
  const canonical = (await resolveStreamerCanonical(slug)) || String(slug || '').toLowerCase();
  const span = Math.min(STREAMER_KEEP_DAYS, Math.max(1, Number(days) || 7));
  const result = await postgresCall((pool) =>
    pool.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day,
              viewers_peak AS "viewersPeak",
              CASE WHEN viewers_samples > 0 THEN ROUND(viewers_sum::numeric / viewers_samples)::int ELSE 0 END AS "viewersAvg",
              viewers_samples AS "viewersSamples",
              elo, matches
       FROM streamer_daily
       WHERE slug = $1 AND day >= (NOW() AT TIME ZONE 'UTC')::date - ($2::int - 1)
       ORDER BY day`,
      [canonical, span]
    )
  );
  const rows =
    result === undefined
      ? [...memoryStreamerDaily.values()]
          .filter((row) => row.slug === canonical)
          .map((row) => ({
            day: row.day,
            viewersPeak: row.viewersPeak,
            viewersAvg: row.viewersSamples ? Math.round(row.viewersSum / row.viewersSamples) : 0,
            viewersSamples: row.viewersSamples,
            elo: row.elo,
            matches: row.matches,
          }))
      : result.rows;
  return { slug: canonical, days: span, series: fillStreamerDays(rows, span, now) };
}

export async function streamerSamplePoints(slug, days = STREAMER_KEEP_DAYS, now = new Date()) {
  const canonical = (await resolveStreamerCanonical(slug)) || String(slug || '').toLowerCase();
  const span = Math.min(STREAMER_KEEP_DAYS, Math.max(1, Number(days) || STREAMER_KEEP_DAYS));
  const since = new Date(now.getTime() - span * 24 * 60 * 60 * 1000);
  const result = await postgresCall((pool) =>
    pool.query(
      `SELECT ts, elo, viewers, match_id AS "matchId"
       FROM streamer_samples
       WHERE slug = $1 AND ts >= $2
       ORDER BY ts`,
      [canonical, since]
    )
  );
  const rows =
    result === undefined
      ? memoryStreamerSamples.get(canonical) || []
      : result.rows.map((row) => samplePoint({ ...row, ts: row.ts instanceof Date ? row.ts.getTime() : row.ts }));
  return {
    slug: canonical,
    points: rows
      .map((row) => samplePoint(row))
      .filter((point) => point.ts >= since.getTime())
      .sort((a, b) => a.ts - b.ts),
  };
}

export async function streamerArchiveRows() {
  const result = await postgresCall((pool) =>
    pool.query(
      `SELECT i.slug,
              COALESCE(i.nickname, i.slug) AS nickname,
              i.avatar,
              i.platform,
              i.twitch,
              i.kick,
              (SELECT d.elo FROM streamer_daily d WHERE d.slug = i.slug AND d.elo IS NOT NULL ORDER BY d.day DESC LIMIT 1) AS elo,
              (SELECT to_char(MAX(d.day), 'YYYY-MM-DD') FROM streamer_daily d WHERE d.slug = i.slug) AS "lastDay"
       FROM streamer_identities i
       WHERE i.slug = i.canonical
       ORDER BY COALESCE(i.nickname, i.slug)`
    )
  );
  if (result === undefined) {
    const lastBySlug = new Map();
    for (const row of memoryStreamerDaily.values()) {
      const prev = lastBySlug.get(row.slug);
      if (!prev || row.day >= prev.day) lastBySlug.set(row.slug, row);
    }
    return [...memoryStreamerIdentities.values()]
      .filter((row) => row.slug && row.slug === row.canonical)
      .map((row) => {
        const daily = lastBySlug.get(row.slug);
        return {
          slug: row.slug,
          nickname: row.nickname || row.slug,
          avatar: row.avatar || null,
          platform: row.platform || (row.twitch ? 'twitch' : 'kick'),
          twitch: row.twitch || null,
          kick: row.kick || null,
          elo: daily?.elo ?? null,
          lastDay: daily?.day || null,
          viewersPeak: daily?.viewersPeak || 0,
          viewersAvg: 0,
          matches: 0,
        };
      })
      .sort((a, b) => String(a.nickname).localeCompare(String(b.nickname)));
  }
  return result.rows.map((row) => ({
    slug: row.slug,
    nickname: row.nickname || row.slug,
    avatar: row.avatar || null,
    platform: row.platform || (row.twitch ? 'twitch' : 'kick'),
    twitch: row.twitch || null,
    kick: row.kick || null,
    elo: Number.isInteger(Number(row.elo)) ? Number(row.elo) : null,
    lastDay: row.lastDay || null,
    viewersPeak: 0,
    viewersAvg: 0,
    matches: 0,
  }));
}

function rankingFromMemory(span, now) {
  const start = utcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (span - 1))));
  const bySlug = new Map();
  for (const row of memoryStreamerDaily.values()) {
    if (row.day < start) continue;
    const cur = bySlug.get(row.slug) || {
      slug: row.slug,
      nickname: row.nickname || row.slug,
      avatar: row.avatar || null,
      platform: row.platform,
      twitch: row.twitch || null,
      kick: row.kick || null,
      guid: row.guid || null,
      viewersPeak: 0,
      viewersSum: 0,
      viewersSamples: 0,
      matches: 0,
      elo: null,
      lastDay: '',
    };
    cur.viewersPeak = Math.max(cur.viewersPeak, row.viewersPeak);
    cur.viewersSum += row.viewersSum;
    cur.viewersSamples += row.viewersSamples;
    cur.matches += row.matches;
    if (row.day >= cur.lastDay && row.elo != null) {
      cur.elo = row.elo;
      cur.lastDay = row.day;
    }
    if (row.nickname) cur.nickname = row.nickname;
    if (row.avatar) cur.avatar = row.avatar;
    if (row.twitch) cur.twitch = row.twitch;
    if (row.kick) cur.kick = row.kick;
    bySlug.set(row.slug, cur);
  }
  return [...bySlug.values()]
    .filter((row) => row.viewersSamples > 0)
    .map((row) => ({
      slug: row.slug,
      nickname: row.nickname,
      avatar: row.avatar,
      platform: row.platform,
      twitch: row.twitch,
      kick: row.kick,
      guid: row.guid,
      viewersPeak: row.viewersPeak,
      viewersAvg: Math.round(row.viewersSum / row.viewersSamples),
      matches: row.matches,
      elo: row.elo,
    }))
    .sort((a, b) => b.viewersAvg - a.viewersAvg || b.viewersPeak - a.viewersPeak || String(a.nickname).localeCompare(String(b.nickname)));
}

export async function streamerRankingRows(days = 7, now = new Date()) {
  const span = Math.min(STREAMER_KEEP_DAYS, Math.max(1, Number(days) || 7));
  const result = await postgresCall((pool) =>
    pool.query(
      `SELECT d.slug,
              MAX(d.nickname) AS nickname,
              MAX(d.avatar) AS avatar,
              MAX(d.platform) AS platform,
              MAX(d.twitch) AS twitch,
              MAX(d.kick) AS kick,
              MAX(d.guid) AS guid,
              MAX(d.viewers_peak) AS "viewersPeak",
              CASE WHEN SUM(d.viewers_samples) > 0
                THEN ROUND(SUM(d.viewers_sum)::numeric / SUM(d.viewers_samples))::int
                ELSE 0 END AS "viewersAvg",
              SUM(d.matches)::int AS matches,
              (ARRAY_AGG(d.elo ORDER BY d.day DESC) FILTER (WHERE d.elo IS NOT NULL))[1] AS elo
       FROM streamer_daily d
       WHERE d.day >= (NOW() AT TIME ZONE 'UTC')::date - ($1::int - 1)
       GROUP BY d.slug
       HAVING SUM(d.viewers_samples) > 0
       ORDER BY 9 DESC, 8 DESC, 2`,
      [span]
    )
  );
  if (result === undefined) return rankingFromMemory(span, now);
  return result.rows.map((row) => ({
    slug: row.slug,
    nickname: row.nickname || row.slug,
    avatar: row.avatar || null,
    platform: row.platform,
    twitch: row.twitch || null,
    kick: row.kick || null,
    guid: row.guid || null,
    viewersPeak: asInt(row.viewersPeak),
    viewersAvg: asInt(row.viewersAvg),
    matches: asInt(row.matches),
    elo: Number.isInteger(Number(row.elo)) ? Number(row.elo) : null,
  }));
}

export function resetStreamerStoreForTests() {
  memoryStreamerDaily.clear();
  memoryStreamerIdentities.clear();
  memoryStreamerSamples.clear();
}
