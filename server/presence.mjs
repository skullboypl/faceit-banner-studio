import { enrichTwitch } from './twitch-live.mjs';
import { clientIp } from '../shared/client-ip.mjs';
import { createRateLimiter } from '../shared/rate-limit.mjs';
import { fillFromPlayerId, knownImageUrl, loadImage, playerIdFromReferer, publicRanking, sanitizeInfo } from './live.mjs';
import { count, once, warn } from './log.mjs';
import { handleFaceitProxy } from './faceit-proxy.mjs';
import { recordOnlineSample, verifiedAmong, withRedis } from './store.mjs';

/** Current widgets ping every minute. Older banners refresh only after a win and never send a heartbeat, so the live pool keeps a banner for an hour after its last contact. */
export const ACTIVE_WINDOW_MS = 60 * 60_000;
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

/** Loads banners that were still inside the activity window when this process started. */
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

/** Admin: the live list and the online counter are rebuilt on the next read. */
export function clearLiveBoard() {
  boardCache = null;
  countCache = null;
}

/** Banners seen in the activity window (read in-process by the admin overview). */
export const getPresenceCount = () => {
  prune();
  return sessions.size;
};

const SAMPLE_MS = 60_000;
let samplerStarted = false;

/**
 * Saves the current banner count into this UTC hour.
 * Waits until Redis has been read, so a restart cannot store 0 and erase the hour.
 * Returns null when that read has not succeeded yet.
 */
export async function captureOnlineSample() {
  await hydratePresence();
  if ((presenceRedis || process.env.REDIS_URL) && !hydrated) return null;
  const online = getPresenceCount();
  await recordOnlineSample(online);
  return online;
}

/** Keeps the hourly peak. A sample runs every minute; the timer does not keep the process alive. */
export function startOnlineHistory() {
  if (samplerStarted) return;
  samplerStarted = true;
  const sample = () => {
    void captureOnlineSample().catch(() => undefined);
  };
  sample();
  const timer = setInterval(sample, SAMPLE_MS);
  timer.unref?.();
}

/** The menu counter is kept for 30 seconds; the live list, a list of people, is kept longer. */
const COUNT_TTL_MS = 30_000;
const BOARD_TTL_MS = 15 * 60_000;

/** LIVE_BOARD_TTL_MS, when set, applies to both. */
function envTtl() {
  const raw = process.env.LIVE_BOARD_TTL_MS;
  if (raw === undefined || raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** A list built while FACEIT was slow is kept only this long. */
const PARTIAL_TTL_MS = 20_000;
const fillDeadlineMs = () => Number(process.env.LIVE_FILL_DEADLINE_MS) || 1800;
const imageDeadlineMs = () => Number(process.env.IMAGE_DEADLINE_MS) || 2200;

export const countTtlMs = () => envTtl() ?? COUNT_TTL_MS;
export const boardTtlMs = () => envTtl() ?? BOARD_TTL_MS;
const publicTtlMs = countTtlMs;

let countCache = null;
let boardCache = null;
let boardInflight = null;

function fresh(entry, ttl = publicTtlMs()) {
  return Boolean(entry) && Date.now() - entry.at < ttl;
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
  /* The list must never wait on FACEIT: nginx gives up after a few seconds. Whatever is filled in by then is shown;
     the rest keeps loading into the caches, and a partial list is rebuilt soon instead of being kept for 15 minutes. */
  const filled = await Promise.race([
    fillFromPlayerId(entries).then(() => true, () => true),
    new Promise((resolve) => setTimeout(() => resolve(false), fillDeadlineMs())),
  ]);
  const signedIn = await verifiedAmong(entries.map((entry) => entry.info?.playerId));
  for (const entry of entries) {
    if (entry.info?.playerId && signedIn.has(entry.info.playerId)) entry.info.confirmed = true;
  }
  const players = publicRanking(entries);
  const at = Date.now();
  const body = {
    online: sessions.size,
    ranked: players.length,
    windowSeconds: ACTIVE_WINDOW_MS / 1000,
    players: players.slice(0, 200),
    generatedAt: at,
    cacheSeconds: Math.round(boardTtlMs() / 1000),
  };
  count('live.builds');
  if (!filled) {
    count('live.partial');
    if (once('live-partial', 30_000)) warn('live', `list built from partial data: FACEIT did not answer within ${fillDeadlineMs()} ms, rebuilding in ${PARTIAL_TTL_MS / 1000}s`);
  }
  boardCache = { at, body, partial: !filled };
  rememberCount(body.online, at);
  return body;
}

/** Public board: nick, ELO, level, country. No session id and no address. */
async function getCachedLiveBoard() {
  if (fresh(boardCache, boardCache?.partial ? Math.min(boardTtlMs(), PARTIAL_TTL_MS) : boardTtlMs())) return boardCache.body;
  if (!boardInflight) {
    boardInflight = buildLiveBoard().finally(() => {
      boardInflight = null;
    });
  }
  return boardInflight;
}

export async function getLiveBoard() {
  const board = await getCachedLiveBoard();
  return { ...board, players: await enrichTwitch(board.players) };
}

const trustedHops = () => Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);

export function createPresenceMiddleware({ unlimitedRate = false } = {}) {
  const allow = () => true;
  const postLimit = unlimitedRate ? allow : createRateLimiter({ perMinute: 12, blockAfter: LOCKOUT });
  const getLimit = unlimitedRate ? allow : createRateLimiter({ perMinute: 60, blockAfter: LOCKOUT });
  /* A live page loads up to 100 avatars at once, and the browser keeps each for hours: no lockout for pictures */
  const avatarLimit = unlimitedRate ? allow : createRateLimiter({ perMinute: 600 });

  return async (req, res, next) => {
    if (await handleFaceitProxy(req, res, { unlimitedRate })) return;
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    const imageKind = pathname.startsWith('/api/presence/cover/') ? 'cover' : 'avatar';
    const avatarId = pathname.startsWith(`/api/presence/${imageKind}/`)
      ? pathname.slice(`/api/presence/${imageKind}/`.length)
      : '';
    if (pathname !== '/api/presence' && pathname !== '/api/presence/live' && !/^[0-9a-f-]{36}$/i.test(avatarId)) {
      return next();
    }

    const now = Date.now();
    const ip = clientIp(req.headers, req.socket.remoteAddress, trustedHops());
    await hydratePresence();

    if (req.method === 'GET' && avatarId) {
      if (!avatarLimit(ip)) {
        /* Past our limit the visitor loads the picture from FACEIT directly, from their own address */
        const direct = knownImageUrl(avatarId, imageKind);
        count('img.limited');
        if (direct) {
          res.statusCode = 302;
          res.setHeader('Location', direct);
          res.setHeader('Cache-Control', 'public, max-age=60');
          return res.end();
        }
        return sendJson(res, 429, { error: 'rate_limited' }, { 'Retry-After': '30' });
      }
      /* A picture that is not ready in time is answered with the FACEIT address; our copy finishes in the background */
      let late;
      const image = await Promise.race([
        loadImage(avatarId, imageKind).catch(() => null),
        new Promise((resolve) => {
          late = setTimeout(() => {
            count('img.late');
            resolve(null);
          }, imageDeadlineMs());
        }),
      ]);
      clearTimeout(late);
      if (!image) {
        /* Our copy could not be made right now: send the browser to the FACEIT picture for a minute */
        const original = knownImageUrl(avatarId, imageKind);
        count(original ? 'img.redirect' : 'img.miss');
        if (original) {
          res.statusCode = 302;
          res.setHeader('Location', original);
          res.setHeader('Cache-Control', 'public, max-age=60');
          return res.end();
        }
        res.statusCode = 404;
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.end();
      }
      count('img.copy');
      res.statusCode = 200;
      res.setHeader('Content-Type', image.type);
      res.setHeader('Content-Length', String(image.body.length));
      res.setHeader('Cache-Control', 'public, max-age=21600');
      return res.end(image.body);
    }

    if (req.method === 'GET') {
      if (!getLimit(ip)) return sendJson(res, 429, { error: 'rate_limited' }, { 'Retry-After': '60' });
      if (pathname === '/api/presence/live') {
        return sendJson(res, 200, await getLiveBoard(), { 'Cache-Control': `public, max-age=${Math.min(60, Math.floor(boardTtlMs() / 1000))}` });
      }
      return sendJson(res, 200, getPublicOnline(), { 'Cache-Control': `public, max-age=${Math.floor(publicTtlMs() / 1000)}` });
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
