import { enrichTwitch } from './twitch-live.mjs';
import { enrichKick } from './kick-live.mjs';
import { ingestLiveStreamers } from './streamers.mjs';
import { clientIp } from '../shared/client-ip.mjs';
import { createRateLimiter } from '../shared/rate-limit.mjs';
import {
  applyCachedProfiles,
  fillFromPlayerId,
  knownImageUrl,
  loadImage,
  mergeLastGoodPlayers,
  PLAYER_ID,
  playerIdFromReferer,
  publicRanking,
  sanitizeInfo,
  warmPlayerCache,
} from './live.mjs';
import { count, once, warn } from './log.mjs';
import { handleFaceitProxy } from './faceit-proxy.mjs';
import {
  getStudioUsersSync,
  hydrateStudioUsers,
  kicksAmong,
  listStudioUsers,
  recordOnlineSample,
  rememberStudioUser,
  resetStudioUsersForTests,
  touchStudioSession,
  twitchesAmong,
  verifiedAmong,
  withRedis,
} from './store.mjs';

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
  resetStudioUsersForTests();
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

function requestHost(req) {
  const raw = String(req?.headers?.host || '');
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end === -1 ? raw : raw.slice(1, end);
  }
  return raw.split(':')[0];
}

/** Local `dev:admin` only. Matches auth.mjs so Dev Admin can appear on the local live list. */
function rememberLocalDevAdmin(req) {
  if (process.env.DEV_ADMIN !== '1' || process.env.NODE_ENV === 'production') return;
  const host = requestHost(req);
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') return;
  rememberStudioUser({ guid: 'dev-admin', nickname: 'Dev Admin', avatar: null });
}

function studioInfo(user) {
  const playerId = PLAYER_ID.test(user.guid) ? user.guid.toLowerCase() : '';
  return sanitizeInfo({
    nickname: user.nickname,
    playerId,
  });
}

/** Studio sessions that are not already represented by a widget heartbeat. */
function countStudioOnly() {
  const users = getStudioUsersSync();
  if (!users.length) return 0;
  const widgetIds = new Set();
  const widgetNicks = new Set();
  for (const entry of sessions.values()) {
    if (entry.info?.playerId) widgetIds.add(entry.info.playerId);
    if (entry.info?.nickname) widgetNicks.add(entry.info.nickname.toLowerCase());
  }
  let extra = 0;
  for (const user of users) {
    const id = PLAYER_ID.test(user.guid) ? user.guid : '';
    if (id && widgetIds.has(id)) continue;
    if (widgetNicks.has(String(user.nickname).toLowerCase())) continue;
    extra += 1;
  }
  return extra;
}

function onlineTotal() {
  return sessions.size + countStudioOnly();
}

function attachStudioUsers(board) {
  const users = getStudioUsersSync();
  const studioNicks = new Set(users.map((user) => String(user.nickname).toLowerCase()));
  const names = new Set(board.players.map((player) => player.nickname.toLowerCase()));
  const extras = [];
  for (const user of users) {
    const info = studioInfo(user);
    if (!info?.nickname || names.has(info.nickname.toLowerCase())) continue;
    names.add(info.nickname.toLowerCase());
    extras.push({
      nickname: info.nickname,
      confirmed: true,
      ...(PLAYER_ID.test(user.guid) ? { avatar: `/api/presence/avatar/${user.guid}` } : {}),
    });
  }
  const players = extras.length ? [...board.players, ...extras] : board.players;
  const marked = players.map((player) =>
    studioNicks.has(player.nickname.toLowerCase()) ? { ...player, confirmed: true } : player
  );
  return {
    ...board,
    players: marked.slice(0, 200),
    ranked: marked.length,
    online: board.online + extras.length,
  };
}

/** Banners seen in the activity window, plus signed-in studio accounts (read in-process by the admin overview). */
export const getPresenceCount = () => {
  prune();
  return onlineTotal();
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
  if (fresh(boardCache)) {
    const attached = attachStudioUsers(boardCache.body);
    return { online: attached.online, windowSeconds: attached.windowSeconds };
  }
  if (fresh(countCache)) return countCache.body;
  prune();
  return rememberCount(onlineTotal());
}

async function buildLiveBoard() {
  prune();
  const entries = [];
  for (const entry of sessions.values()) {
    if (entry.info) entries.push({ info: { ...entry.info }, lastSeen: entry.lastSeen });
  }
  const studio = await listStudioUsers();
  const seenIds = new Set(entries.map((entry) => entry.info?.playerId).filter(Boolean));
  const seenNicks = new Set(
    entries.map((entry) => entry.info?.nickname?.toLowerCase()).filter(Boolean)
  );
  for (const user of studio) {
    const info = studioInfo(user);
    if (!info) continue;
    if (info.playerId && seenIds.has(info.playerId)) continue;
    if (info.nickname && seenNicks.has(info.nickname.toLowerCase())) continue;
    if (info.playerId) seenIds.add(info.playerId);
    if (info.nickname) seenNicks.add(info.nickname.toLowerCase());
    entries.push({ info, lastSeen: Date.now() });
  }
  /* Redis/Postgres snapshots first, so a slow FACEIT cannot blank nicks and ELO after a deploy. */
  await warmPlayerCache([...seenIds]);
  applyCachedProfiles(entries);
  const previousPlayers = boardCache?.body?.players;
  /* The list must never wait on FACEIT: nginx gives up after a few seconds. Whatever is filled in by then is shown;
     the rest keeps loading into the caches, and a partial list is rebuilt soon instead of being kept for 15 minutes. */
  const filled = await Promise.race([
    fillFromPlayerId(entries).then(() => true, () => true),
    new Promise((resolve) => setTimeout(() => resolve(false), fillDeadlineMs())),
  ]);
  if (!filled) applyCachedProfiles(entries);
  const signedIn = await verifiedAmong(entries.map((entry) => entry.info?.playerId));
  const kicks = await kicksAmong(entries.map((entry) => entry.info?.playerId));
  const twitches = await twitchesAmong(entries.map((entry) => entry.info?.playerId));
  const studioIds = new Set(studio.map((user) => user.guid).filter((id) => PLAYER_ID.test(id)));
  const studioNicks = new Set(studio.map((user) => String(user.nickname).toLowerCase()));
  for (const entry of entries) {
    const id = entry.info?.playerId;
    if (
      (id && signedIn.has(id)) ||
      (id && studioIds.has(id)) ||
      (entry.info?.nickname && studioNicks.has(entry.info.nickname.toLowerCase()))
    ) {
      entry.info.confirmed = true;
    }
    const kick = id ? kicks.get(id) : '';
    if (kick) entry.info.kick = kick;
    const twitch = id ? twitches.get(id) : '';
    if (twitch) entry.info.twitch = twitch;
  }
  let players = publicRanking(entries);
  if (!filled && previousPlayers?.length) players = mergeLastGoodPlayers(players, previousPlayers);
  const at = Date.now();
  const body = {
    online: onlineTotal(),
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
  await hydrateStudioUsers();
  const board = attachStudioUsers(await getCachedLiveBoard());
  const players = await enrichKick(await enrichTwitch(board.players));
  void ingestLiveStreamers(players).catch(() => undefined);
  return { ...board, players };
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
    await hydrateStudioUsers();
    await touchStudioSession(req.headers.cookie);
    rememberLocalDevAdmin(req);

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
