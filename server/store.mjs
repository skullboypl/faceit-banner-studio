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

async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  redisPromise ??= import('ioredis').then(
    ({ default: Redis }) => new Redis(process.env.REDIS_URL, { lazyConnect: false })
  );
  return redisPromise;
}

async function getPostgres() {
  if (!process.env.DATABASE_URL) return null;
  postgresPromise ??= import('pg').then(async ({ default: pg }) => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
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
  });
  return postgresPromise;
}

export async function saveSession(id, user) {
  const redis = await getRedis();
  if (redis) {
    await redis.set(`fb:session:${id}`, JSON.stringify(user), 'EX', SESSION_TTL_SECONDS);
    return;
  }
  memorySessions.set(id, { user, expires: Date.now() + SESSION_TTL_SECONDS * 1000 });
}

export async function loadSession(id) {
  const redis = await getRedis();
  if (redis) {
    const raw = await redis.get(`fb:session:${id}`);
    return raw ? JSON.parse(raw) : null;
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
  const redis = await getRedis();
  if (redis) {
    await redis.del(`fb:session:${id}`);
    return;
  }
  memorySessions.delete(id);
}

/** One-time OAuth state, valid for 10 minutes and consumed on first use. */
export async function saveState(state) {
  const redis = await getRedis();
  if (redis) {
    await redis.set(`fb:state:${state}`, '1', 'EX', 600);
    return;
  }
  memorySessions.set(`state:${state}`, { user: true, expires: Date.now() + 600_000 });
}

export async function consumeState(state) {
  const redis = await getRedis();
  if (redis) {
    return (await redis.del(`fb:state:${state}`)) === 1;
  }
  const entry = memorySessions.get(`state:${state}`);
  memorySessions.delete(`state:${state}`);
  return Boolean(entry && entry.expires >= Date.now());
}

export async function recordLogin(user, ip) {
  const entry = { guid: user.guid, nickname: user.nickname, avatar: user.avatar ?? null, ip: ip ?? null, createdAt: new Date().toISOString() };
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
  memoryLogins.unshift(entry);
  memoryLogins.length = Math.min(memoryLogins.length, 200);
}

export async function recentLogins(limit = 50) {
  const pool = await getPostgres();
  if (pool) {
    const { rows } = await pool.query(
      'SELECT guid, nickname, avatar, ip, created_at AS "createdAt" FROM logins ORDER BY id DESC LIMIT $1',
      [limit]
    );
    return rows;
  }
  return memoryLogins.slice(0, limit);
}

export async function storageStatus() {
  return {
    sessions: process.env.REDIS_URL ? 'redis' : 'memory',
    logins: process.env.DATABASE_URL ? 'postgres' : 'memory',
  };
}
