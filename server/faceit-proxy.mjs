import { createRateLimiter } from '../shared/rate-limit.mjs';
import { faceitFetch, faceitPressure, faceitServerKey, rememberImageSources } from './faceit-gate.mjs';
import { count, once, warn } from './log.mjs';
import { clientIp } from '../shared/client-ip.mjs';
import { clearFaceitAnswers, loadFaceitAnswer, removeFaceitAnswers, saveFaceitAnswer } from './store.mjs';

/** Repeated reads of the same player reuse this answer instead of calling FACEIT again. */
export const FACEIT_TTL_MS = 30_000;
/** A place in a ranking moves slowly, and two lookups per player add up: keep those longer. */
export const FACEIT_RANKING_TTL_MS = 10 * 60_000;
const PREFIX = '/api/faceit/v4';
const CACHE_LIMIT = 400;
/** How many keys remember that their stored copy was already served once. */
const PAINTED_LIMIT = 20_000;
const STALE_ANSWER_MS = 10 * 60_000;
/** A profile or stat read is kept up to this long when the player has not finished a match since. */
const SMART_MAX_MS = 10 * 60_000;
/** Redis/Postgres copies stay good for first paint after a deploy; the next refresh still checks FACEIT. */
const STORE_KEEP_MS = 6 * 60 * 60_000;
/** After a new match, reads stay at the normal pace this long, so the ELO FACEIT updates a little later is picked up. */
const HOT_MS = 2 * 60_000;
const RETRY_SOON_MS = 5_000;
const MAX_BODY = 1_500_000;
const PLAYER = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const MATCH = '[0-9a-zA-Z-]{8,80}';
const ALLOWED = [
  /^\/players$/i,
  /^\/search\/players$/i,
  new RegExp(`^\\/players\\/${PLAYER}$`, 'i'),
  new RegExp(`^\\/players\\/${PLAYER}\\/games\\/cs2\\/stats$`, 'i'),
  new RegExp(`^\\/players\\/${PLAYER}\\/stats\\/cs2$`, 'i'),
  new RegExp(`^\\/players\\/${PLAYER}\\/history$`, 'i'),
  new RegExp(`^\\/players\\/${PLAYER}\\/active$`, 'i'),
  new RegExp(`^\\/rankings\\/games\\/cs2\\/regions\\/[A-Za-z0-9_-]{2,8}\\/players\\/${PLAYER}$`, 'i'),
  /* One place of a region's ladder (1, 10, 100 or 1000), for "ELO to top N" */
  /^\/rankings\/games\/cs2\/regions\/[A-Za-z0-9_-]{2,8}$/i,
  new RegExp(`^\\/matches\\/${MATCH}$`, 'i'),
  new RegExp(`^\\/matches\\/${MATCH}\\/stats$`, 'i'),
];

/** A running match comes first, then the lobby states, in the order a match moves through them. */
const ACTIVE_STATES = ['ONGOING', 'READY', 'CONFIGURING', 'SUBSTITUTION', 'CAPTAIN_PICK', 'VOTING', 'SCHEDULED'];
const SITE_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'faceitbanner/1.0 (faceitbanner.vxh.pl)',
};

/**
 * The Data API lists only finished matches. The public site knows what a player is in right now:
 * this reduces its answer to the one match worth showing, or to {} when the player is idle.
 */
export function activeMatchFrom(body) {
  let payload;
  try {
    payload = JSON.parse(body)?.payload;
  } catch {
    return '{}';
  }
  for (const status of ACTIVE_STATES) {
    const id = payload?.[status]?.[0]?.id;
    if (typeof id === 'string' && /^[0-9a-zA-Z-]{8,80}$/.test(id)) return JSON.stringify({ match_id: id, status });
  }
  return '{}';
}

function faceitKey() {
  return faceitServerKey();
}

function cleanNick(value) {
  if (typeof value !== 'string') return '';
  const nick = value.trim();
  if (nick.length < 2 || nick.length > 32) return '';
  if (/[\u0000-\u001F\u007F<>]/.test(nick)) return '';
  return nick;
}

function intIn(value, min, max) {
  if (value === null || value === '') return null;
  if (!/^\d+$/.test(String(value))) return undefined;
  const number = Number(value);
  return number >= min && number <= max ? String(number) : undefined;
}

/**
 * Allowlisted FACEIT Data API path. The cache key is the path plus the few
 * accepted query fields, so two callers asking for the same player share one read.
 */
export function faceitTarget(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl || '/', 'http://localhost');
  } catch {
    return null;
  }
  if (!parsed.pathname.startsWith(`${PREFIX}/`)) return null;
  const path = decodeURIComponent(parsed.pathname.slice(PREFIX.length));
  if (!path.startsWith('/') || path.includes('..') || !ALLOWED.some((pattern) => pattern.test(path))) return null;
  const params = new URLSearchParams();
  const keep = (name, value) => {
    if (value === undefined) return false;
    if (value !== null) params.set(name, value);
    return true;
  };
  if (path.toLowerCase() === '/players') {
    const nick = cleanNick(parsed.searchParams.get('nickname') || '');
    if (!nick) return null;
    params.set('nickname', nick);
  } else if (path.toLowerCase() === '/search/players') {
    /* The nickname lookup is case-sensitive; the search finds "skullboy" typed in a chat as well */
    const nick = cleanNick(parsed.searchParams.get('nickname') || '');
    if (!nick) return null;
    params.set('nickname', nick.toLowerCase());
    params.set('game', 'cs2');
    params.set('offset', '0');
    if (!keep('limit', intIn(parsed.searchParams.get('limit'), 1, 20))) return null;
  } else if (/\/stats$/i.test(path) && path.includes('/games/')) {
    if (!keep('limit', intIn(parsed.searchParams.get('limit'), 1, 100))) return null;
  } else if (/\/history$/i.test(path)) {
    const game = parsed.searchParams.get('game') || 'cs2';
    if (game !== 'cs2') return null;
    params.set('game', 'cs2');
    if (!keep('offset', intIn(parsed.searchParams.get('offset'), 0, 20))) return null;
    if (!keep('limit', intIn(parsed.searchParams.get('limit'), 1, 10))) return null;
  } else if (/^\/rankings\/games\/cs2\/regions\/[A-Za-z0-9_-]{2,8}$/i.test(path)) {
    /* Only the milestone places, one at a time, so every banner shares the same few cached answers */
    const offset = parsed.searchParams.get('offset');
    if (!['0', '9', '99', '999'].includes(offset || '') || parsed.searchParams.get('limit') !== '1') return null;
    params.set('offset', offset);
    params.set('limit', '1');
  } else if (path.includes('/rankings/')) {
    const country = parsed.searchParams.get('country');
    if (country) {
      if (!/^[a-z]{2}$/i.test(country)) return null;
      params.set('country', country.toLowerCase());
    }
  }
  const active = path.match(new RegExp(`^\\/players\\/(${PLAYER})\\/active$`, 'i'));
  if (active) {
    return {
      upstream: `https://www.faceit.com/api/match/v1/matches/groupByState?userId=${active[1].toLowerCase()}`,
      key: `${path.toLowerCase()}?`,
      site: true,
    };
  }
  /* Match stats only change when the player finishes a match: their freshness can be checked with one cheap call.
     The profile is not one of them: it carries the ELO, which FACEIT can move before the match is listed, so it
     follows the normal 30-second pace. */
  const watched = path.match(new RegExp(`^\/players\/(${PLAYER})(?:\/games\/cs2\/stats|\/stats\/cs2)$`, 'i'));
  const query = params.toString();
  const player = path.toLowerCase() === '/players' || new RegExp(`^\\/players\\/${PLAYER}$`, 'i').test(path);
  const playerId = path.match(new RegExp(`/players/(${PLAYER})`, 'i'));
  return {
    upstream: `https://open.faceit.com/data/v4${path}${query ? `?${query}` : ''}`,
    key: `${path.toLowerCase()}?${query}`,
    ttl: path.includes('/rankings/') ? FACEIT_RANKING_TTL_MS : undefined,
    watch: watched ? watched[1].toLowerCase() : undefined,
    /** Player reads also ask the public site whether this season is still unranked. */
    calibrate: player,
    guid: playerId ? playerId[1].toLowerCase() : undefined,
  };
}

/**
 * The Data API keeps the previous season's level and ELO during placements.
 * The public site profile is the one that says the player is still calibrating.
 * A failed lookup leaves the Data API body unchanged.
 */
/** Player reads point the avatar and the cover at the copies this server keeps, so the FACEIT CDN is asked once, not by every banner. */
export function withLocalImages(body) {
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return body;
  }
  const id = data?.player_id;
  if (typeof id !== 'string' || !new RegExp(`^${PLAYER}$`, 'i').test(id)) return body;
  const own = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && (url.hostname.endsWith('.faceit-cdn.net') || url.hostname.endsWith('.faceit.com'));
    } catch {
      return false;
    }
  };
  let changed = false;
  rememberImageSources(id, { avatar: own(data.avatar) ? data.avatar : undefined, cover: own(data.cover_image) ? data.cover_image : undefined });
  if (own(data.avatar)) {
    data.avatar = `/api/presence/avatar/${id.toLowerCase()}`;
    changed = true;
  }
  if (own(data.cover_image)) {
    data.cover_image = `/api/presence/cover/${id.toLowerCase()}`;
    changed = true;
  }
  return changed ? JSON.stringify(data) : body;
}

export async function withCalibration(body, fetcher) {
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return body;
  }
  const id = data?.player_id;
  if (typeof id !== 'string' || !new RegExp(`^${PLAYER}$`, 'i').test(id) || !data.games?.cs2) return body;
  try {
    const response = await fetcher(`https://www.faceit.com/api/users/v1/users/${id}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    const ok = response?.ok === true || response?.status === 200;
    if (!ok) return body;
    const site = JSON.parse(await response.text());
    let changed = false;
    if (site?.payload?.games?.cs2?.is_calibrating === true) {
      data.games.cs2.is_calibrating = true;
      changed = true;
    }
    /* The Twitch / Kick account the player linked on FACEIT; only a plain channel name is passed on */
    const twitch = site?.payload?.streaming?.twitch_id;
    if (typeof twitch === 'string' && /^[A-Za-z0-9_]{3,25}$/.test(twitch)) {
      data.twitch_id = twitch;
      changed = true;
    }
    const kick = site?.payload?.streaming?.kick_id;
    if (typeof kick === 'string' && /^[A-Za-z0-9_]{3,25}$/.test(kick)) {
      data.kick_id = kick;
      changed = true;
    }
    if (changed) return JSON.stringify(data);
  } catch {
    /* the Data API answer still stands */
  }
  return body;
}

const durableFaceitAnswers = {
  load: (id, key) => loadFaceitAnswer(id, key),
  save: (id, key, entry) => saveFaceitAnswer(id, key, entry),
  remove: (id) => removeFaceitAnswers(id),
  clear: () => clearFaceitAnswers(),
};

export function createFaceitCache({
  now = Date.now,
  fetcher = faceitFetch,
  getKey = faceitKey,
  ttl = FACEIT_TTL_MS,
  pressure = faceitPressure,
  store = null,
} = {}) {
  const cache = new Map();
  const pending = new Map();
  /** Keys whose stored copy was already served once by this process. */
  const painted = new Set();
  /** player id → the newest finished match seen, and when it changed */
  const heads = new Map();
  const remember = (key, entry) => {
    cache.delete(key);
    cache.set(key, entry);
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  };
  /** Newest finished match of a player: one small read, shared with every other read of the same history. */
  const headOf = async (player) => {
    const entry = await load(faceitTarget(`/api/faceit/v4/players/${player}/history?game=cs2&offset=0&limit=1`));
    let head = null;
    try {
      head = entry.status === 200 ? (JSON.parse(entry.body)?.items?.[0]?.match_id ?? null) : null;
    } catch {
      head = null;
    }
    if (typeof head !== 'string') return null;
    const seen = heads.get(player);
    if (!seen) heads.set(player, { head, changedAt: -Infinity });
    else if (seen.head !== head) heads.set(player, { head, changedAt: now() });
    return head;
  };
  const persist = (target, entry, playerId) => {
    const id = playerId || target.guid;
    if (!id || !store?.save || entry?.status !== 200) return;
    void Promise.resolve(store.save(id, target.key, entry)).catch(() => undefined);
  };
  const load = (target) => {
    const hit = cache.get(target.key);
    /* Under load answers are kept longer, so a busy server asks FACEIT less instead of more */
    const keep = (target.ttl ?? ttl) * (1 + 3 * Math.min(1, Math.max(0, pressure())));
    if (hit && now() - hit.at < keep) {
      count('cache.hit');
      return Promise.resolve(hit);
    }
    const waiting = pending.get(target.key);
    if (waiting) return waiting;
    const hydrate = async () => {
      if (hit || !store?.load || !target.guid) return hit;
      const stored = await Promise.resolve(store.load(target.guid, target.key)).catch(() => null);
      if (!stored || stored.status !== 200 || typeof stored.body !== 'string') return hit;
      const entry = { ...stored, stored: true };
      remember(target.key, entry);
      return entry;
    };
    /* The last good answer: ten minutes from memory, six hours from Redis/Postgres after a restart. */
    const fallback = (live) => {
      const row = live || hit;
      if (!row || row.status !== 200) return null;
      const age = now() - (row.fetchedAt ?? row.at);
      if (age > STORE_KEEP_MS) return null;
      if (age > STALE_ANSWER_MS && !row.stored) return null;
      count('cache.stale');
      if (once('cache-stale', 60_000)) warn('faceit', 'FACEIT refused or failed: serving the last good answers');
      const entry = { ...row, at: now() - ttl + RETRY_SOON_MS };
      remember(target.key, entry);
      return entry;
    };
    const task = (async () => {
      const stored = await hydrate();
      const live = stored || hit;
      if (live && now() - live.at < keep) {
        count('cache.hit');
        return live;
      }
      /* A copy from Redis/Postgres paints once per key after a restart. Every later read checks FACEIT, even when
       * the copy is loaded again after being pushed out of memory, or a banner would show it for six hours. */
      if (live?.stored && !painted.has(target.key) && live.status === 200 && now() - (live.fetchedAt ?? live.at) < STORE_KEEP_MS) {
        painted.add(target.key);
        while (painted.size > PAINTED_LIMIT) painted.delete(painted.values().next().value);
        const same = { ...live, at: now(), stored: true };
        count('cache.kept');
        remember(target.key, same);
        return same;
      }
      let head = null;
      if (target.watch) {
        head = await headOf(target.watch).catch(() => null);
        const seen = heads.get(target.watch);
        const settled = seen && now() - seen.changedAt > HOT_MS;
        /* Nothing new since this was read: keep it, and ask again in a minute or so */
        if (live && live.status === 200 && head && live.head === head && settled && now() - live.fetchedAt < SMART_MAX_MS) {
          const same = { ...live, at: now() };
          count('cache.kept');
          remember(target.key, same);
          return same;
        }
      }
      count('cache.miss');
      try {
        const response = await fetcher(target.upstream, {
          headers: target.site ? SITE_HEADERS : { Authorization: `Bearer ${getKey()}`, Accept: 'application/json' },
          timeoutMs: 8000,
        });
        if (response.status === 429 || response.status >= 500) {
          const stale = fallback(live);
          if (stale) return stale;
        }
        let body = (await response.text()).slice(0, MAX_BODY);
        if (response.status === 200 && target.site) body = activeMatchFrom(body);
        if (response.status === 200 && target.calibrate) body = await withCalibration(body, fetcher);
        if (response.status === 200 && target.calibrate) body = withLocalImages(body);
        const entry = { status: response.status, body, at: now(), fetchedAt: now(), head };
        remember(target.key, entry);
        let playerId = target.guid;
        if (!playerId && response.status === 200) {
          try {
            const id = JSON.parse(body)?.player_id;
            if (typeof id === 'string' && new RegExp(`^${PLAYER}$`, 'i').test(id)) playerId = id.toLowerCase();
          } catch {
            playerId = undefined;
          }
        }
        persist(target, entry, playerId);
        return entry;
      } catch {
        const stale = fallback(live);
        if (stale) return stale;
        const entry = { status: 502, body: JSON.stringify({ error: 'faceit_unavailable' }), at: now() };
        remember(target.key, entry);
        return entry;
      }
    })().finally(() => pending.delete(target.key));
    pending.set(target.key, task);
    return task;
  };
  /** Forgets every cached read, including the ones still in flight, so the next read goes to FACEIT. */
  const clear = () => {
    cache.clear();
    pending.clear();
    void Promise.resolve(store?.clear?.()).catch(() => undefined);
  };
  /** Drops reads that mention this player, so their next banner/list read goes to FACEIT. */
  const dropPlayer = (id) => {
    const needle = String(id || '').toLowerCase();
    if (!needle) return;
    for (const key of [...cache.keys()]) {
      if (key.includes(needle)) cache.delete(key);
    }
    for (const key of [...pending.keys()]) {
      if (key.includes(needle)) pending.delete(key);
    }
    void Promise.resolve(store?.remove?.(needle)).catch(() => undefined);
  };
  return { load, clear, dropPlayer };
}

const shared = createFaceitCache({ store: durableFaceitAnswers });

/**
 * One Data API read through the same cache the banners use, for server code (the chat command).
 * `path` is the part after /data/v4, for example `/players?nickname=SkullBoy`. An address outside the allowlist,
 * or a server without a FACEIT key, gives a 400 or 503 entry instead of a request.
 */
export async function readFaceit(path) {
  const target = faceitTarget(`${PREFIX}${path}`);
  if (!target) return { status: 400, body: '{}' };
  if (!faceitKey()) return { status: 503, body: '{}' };
  return shared.load(target);
}

/** Admin: drop every cached FACEIT answer. */
export const clearFaceitCache = () => shared.clear();
/** One player: Twitch, stats and match reads for this FACEIT id. */
export const clearFaceitCacheForPlayer = (id) => shared.dropPlayer(id);
const limit = createRateLimiter({ perMinute: 180, blockAfter: { strikes: 8, windowMs: 60_000, blockMs: 60_000 } });

function send(res, status, body, extra = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, max-age=30');
  for (const [name, value] of Object.entries(extra)) res.setHeader(name, value);
  res.end(body);
}

/** Serves a cached FACEIT read. Returns false when the path is not this proxy. */
export async function handleFaceitProxy(req, res, { unlimitedRate = false } = {}) {
  const target = faceitTarget(req.url || '/');
  if (!target) {
    if (!String(req.url || '').startsWith(PREFIX)) return false;
    send(res, 404, JSON.stringify({ error: 'not_found' }));
    return true;
  }
  if (req.method !== 'GET') {
    send(res, 405, JSON.stringify({ error: 'method_not_allowed' }));
    return true;
  }
  const ip = clientIp(req.headers, req.socket?.remoteAddress, Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1));
  if (!unlimitedRate && !limit(ip)) {
    send(res, 429, JSON.stringify({ error: 'rate_limited' }), { 'Retry-After': '15' });
    return true;
  }
  if (!faceitKey()) {
    send(res, 503, JSON.stringify({ error: 'faceit_unavailable' }));
    return true;
  }
  const entry = await shared.load(target);
  send(res, entry.status, entry.body || '{}');
  return true;
}
