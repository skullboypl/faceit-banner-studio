import { clientIp } from '../shared/client-ip.mjs';
import { createRateLimiter } from '../shared/rate-limit.mjs';
import { fillFromPlayerId, playerIdFromReferer, publicRanking, sanitizeInfo } from './live.mjs';
import { withRedis } from './store.mjs';

/** Current widgets ping every minute. Older banners and OBS browser sources can ping only every few minutes, so a two-minute window dropped them. */
export const ACTIVE_WINDOW_MS = 15 * 60_000;
const MAX_SESSIONS = 100_000;
/** More distinct banners than this from one address is not a streamer, it is somebody inflating the counter. */
const MAX_BANNERS_PER_IP = 30;
const LOCKOUT = { strikes: 5, windowMs: 5 * 60_000, blockMs: 15 * 60_000 };

/** id → { lastSeen, ip }; the id is a random string the widget keeps in its own localStorage. */
const sessions = new Map();
const bannersPerIp = new Map();

const PRESENCE_PREFIX = 'fb:live:';
const PRESENCE_TTL_SECONDS = Math.ceil(ACTIVE_WINDOW_MS / 1000);
const SESSION_ID = /^[a-zA-Z0-9_-]{16,80}$/;

/** Tests pass a stand-in. Production uses the shared login Redis client. */
let presenceRedis;
export function usePresenceRedis(client) {
  presenceRedis = client;
  hydrated = false;
}

async function touchRedis(run) {
  try {
    if (presenceRedis) {
      await run(presenceRedis);
      return true;
    }
    return await withRedis(run);
  } catch {
    return false;
  }
}

function persistSession(id, entry) {
  const payload = JSON.stringify({
    lastSeen: entry.lastSeen,
    firstSeen: entry.firstSeen,
    ip: entry.ip,
    info: entry.info ?? null,
  });
  return touchRedis((redis) => redis.set(`${PRESENCE_PREFIX}${id}`, payload, 'EX', PRESENCE_TTL_SECONDS));
}

function dropSession(id) {
  return touchRedis((redis) => redis.del(`${PRESENCE_PREFIX}${id}`));
}

let hydrated = false;
let hydrating = null;

/** Loads banners that were still inside the 15-minute window when this process started. */
export function hydratePresence() {
  if (hydrated) return Promise.resolve();
  hydrating ??= loadPresence().finally(() => {
    hydrating = null;
  });
  return hydrating;
}

async function loadPresence() {
  if (!presenceRedis && !process.env.REDIS_URL) {
    hydrated = true;
    return;
  }
  const loaded = [];
  const ok = await touchRedis(async (redis) => {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${PRESENCE_PREFIX}*`, 'COUNT', 200);
      cursor = String(next);
      if (!keys?.length) continue;
      const values = await redis.mget(...keys);
      keys.forEach((key, index) => {
        if (values[index]) loaded.push([key.slice(PRESENCE_PREFIX.length), values[index]]);
      });
    } while (cursor !== '0');
  });
  if (!ok) return;
  const now = Date.now();
  for (const [id, raw] of loaded) {
    if (!SESSION_ID.test(id) || sessions.has(id)) continue;
    let entry;
    try {
      entry = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!entry || typeof entry.ip !== 'string' || typeof entry.lastSeen !== 'number') continue;
    if (now - entry.lastSeen > ACTIVE_WINDOW_MS) continue;
    sessions.set(id, {
      lastSeen: entry.lastSeen,
      firstSeen: typeof entry.firstSeen === 'number' ? entry.firstSeen : entry.lastSeen,
      ip: entry.ip,
      info: entry.info ?? null,
    });
    bannersPerIp.set(entry.ip, (bannersPerIp.get(entry.ip) ?? 0) + 1);
  }
  hydrated = true;
}

/** Clears the in-memory board so a test can pretend the process restarted. Redis is left as-is. */
export function resetPresenceForTests() {
  sessions.clear();
  bannersPerIp.clear();
  countCache = null;
  boardCache = null;
  hydrated = false;
  hydrating = null;
}

function forget(id) {
  const entry = sessions.get(id);
  if (!entry) return;
  sessions.delete(id);
  const left = (bannersPerIp.get(entry.ip) ?? 1) - 1;
  if (left > 0) bannersPerIp.set(entry.ip, left);
  else bannersPerIp.delete(entry.ip);
  void dropSession(id);
}

function prune(now = Date.now()) {
  for (const [id, entry] of sessions) {
    if (now - entry.lastSeen > ACTIVE_WINDOW_MS) forget(id);
  }
}

function sendJson(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2048) reject(new Error('payload_too_large'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

/** Banners seen in the activity window (read in-process by the admin overview). */
export const getPresenceCount = () => {
  prune();
  return sessions.size;
};

/** Public menu count and the live list share one snapshot so open studios do not each rebuild it. */
const PUBLIC_TTL_MS = 30_000;

function publicTtlMs() {
  const raw = process.env.LIVE_BOARD_TTL_MS;
  if (raw === undefined || raw === '') return PUBLIC_TTL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : PUBLIC_TTL_MS;
}

let countCache = null;
let boardCache = null;
let boardInflight = null;

function fresh(entry) {
  return Boolean(entry) && Date.now() - entry.at < publicTtlMs();
}

function rememberCount(online, at = Date.now()) {
  countCache = { at, body: { online, windowSeconds: ACTIVE_WINDOW_MS / 1000 } };
  return countCache.body;
}

/** Cheap counter for the studio menu. Reuses the live-list snapshot when that one is still warm. */
export function getPublicOnline() {
  if (fresh(boardCache)) return { online: boardCache.body.online, windowSeconds: boardCache.body.windowSeconds };
  if (fresh(countCache)) return countCache.body;
  prune();
  return rememberCount(sessions.size);
}

async function buildLiveBoard() {
  prune();
  const entries = [];
  for (const entry of sessions.values()) {
    if (entry.info) entries.push({ info: { ...entry.info }, lastSeen: entry.lastSeen });
  }
  await fillFromPlayerId(entries);
  const players = publicRanking(entries);
  const at = Date.now();
  const body = {
    online: sessions.size,
    ranked: players.length,
    windowSeconds: ACTIVE_WINDOW_MS / 1000,
    players: players.slice(0, 200),
  };
  boardCache = { at, body };
  rememberCount(body.online, at);
  return body;
}

/** Public board: nick, ELO, level, country. No session id and no address. */
export async function getLiveBoard() {
  if (fresh(boardCache)) return boardCache.body;
  if (!boardInflight) {
    boardInflight = buildLiveBoard().finally(() => {
      boardInflight = null;
    });
  }
  return boardInflight;
}

const trustedHops = () => Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);

export function createPresenceMiddleware({ unlimitedRate = false } = {}) {
  const allow = () => true;
  const postLimit = unlimitedRate ? allow : createRateLimiter({ perMinute: 12, blockAfter: LOCKOUT });
  const getLimit = unlimitedRate ? allow : createRateLimiter({ perMinute: 60, blockAfter: LOCKOUT });

  return async (req, res, next) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (pathname !== '/api/presence' && pathname !== '/api/presence/live') return next();

    const now = Date.now();
    const ip = clientIp(req.headers, req.socket.remoteAddress, trustedHops());
    await hydratePresence();

    if (req.method === 'GET') {
      if (!getLimit(ip)) return sendJson(res, 429, { error: 'rate_limited' }, { 'Retry-After': '60' });
      const cacheControl = { 'Cache-Control': `public, max-age=${Math.floor(publicTtlMs() / 1000)}` };
      if (pathname === '/api/presence/live') return sendJson(res, 200, await getLiveBoard(), cacheControl);
      return sendJson(res, 200, getPublicOnline(), cacheControl);
    }

    prune(now);

    if (pathname !== '/api/presence' || req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    if (!postLimit(ip)) return sendJson(res, 429, { error: 'rate_limited' }, { 'Retry-After': '60' });

    try {
      const body = await readJson(req);
      const id = typeof body.id === 'string' ? body.id : '';
      if (!SESSION_ID.test(id)) {
        return sendJson(res, 400, { error: 'invalid_session' });
      }
      const known = sessions.get(id);
      if (!known) {
        if (sessions.size >= MAX_SESSIONS) {
          prune(now);
          if (sessions.size >= MAX_SESSIONS) return sendJson(res, 503, { error: 'capacity' });
        }
        if ((bannersPerIp.get(ip) ?? 0) >= MAX_BANNERS_PER_IP) {
          return sendJson(res, 429, { error: 'too_many_banners' }, { 'Retry-After': '120' });
        }
        bannersPerIp.set(ip, (bannersPerIp.get(ip) ?? 0) + 1);
      }
      const parsed = body.info === undefined ? known?.info ?? null : sanitizeInfo(body.info) ?? known?.info ?? null;
      const fromPage = parsed?.playerId ? '' : playerIdFromReferer(req.headers.referer || req.headers.referrer);
      const info = fromPage ? { ...(parsed || {}), playerId: fromPage } : parsed;
      const saved = { lastSeen: now, ip: known?.ip ?? ip, info, firstSeen: known?.firstSeen ?? now };
      sessions.set(id, saved);
      await persistSession(id, saved);
      return sendJson(res, 200, {
        online: sessions.size,
        windowSeconds: ACTIVE_WINDOW_MS / 1000,
      });
    } catch (error) {
      return sendJson(res, error.message === 'payload_too_large' ? 413 : 400, {
        error: error.message,
      });
    }
  };
}
