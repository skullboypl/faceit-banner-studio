import { createRateLimiter } from '../shared/rate-limit.mjs';
import { clientIp } from '../shared/client-ip.mjs';

/** Repeated reads of the same player reuse this answer instead of calling FACEIT again. */
export const FACEIT_TTL_MS = 15_000;
/** A place in a ranking moves slowly, and two lookups per player add up: keep those longer. */
export const FACEIT_RANKING_TTL_MS = 10 * 60_000;
const PREFIX = '/api/faceit/v4';
const CACHE_LIMIT = 400;
const MAX_BODY = 1_500_000;
const PLAYER = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const MATCH = '[0-9a-zA-Z-]{8,80}';
const ALLOWED = [
  /^\/players$/i,
  new RegExp(`^\\/players\\/${PLAYER}$`, 'i'),
  new RegExp(`^\\/players\\/${PLAYER}\\/games\\/cs2\\/stats$`, 'i'),
  new RegExp(`^\\/players\\/${PLAYER}\\/stats\\/cs2$`, 'i'),
  new RegExp(`^\\/players\\/${PLAYER}\\/history$`, 'i'),
  new RegExp(`^\\/players\\/${PLAYER}\\/active$`, 'i'),
  new RegExp(`^\\/rankings\\/games\\/cs2\\/regions\\/[A-Za-z0-9_-]{2,8}\\/players\\/${PLAYER}$`, 'i'),
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
  return process.env.FACEIT_API_KEY || process.env.VITE_FACEIT_API_KEY || '';
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
  } else if (/\/stats$/i.test(path) && path.includes('/games/')) {
    if (!keep('limit', intIn(parsed.searchParams.get('limit'), 1, 100))) return null;
  } else if (/\/history$/i.test(path)) {
    const game = parsed.searchParams.get('game') || 'cs2';
    if (game !== 'cs2') return null;
    params.set('game', 'cs2');
    if (!keep('offset', intIn(parsed.searchParams.get('offset'), 0, 20))) return null;
    if (!keep('limit', intIn(parsed.searchParams.get('limit'), 1, 10))) return null;
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
  const query = params.toString();
  const player = path.toLowerCase() === '/players' || new RegExp(`^\\/players\\/${PLAYER}$`, 'i').test(path);
  return {
    upstream: `https://open.faceit.com/data/v4${path}${query ? `?${query}` : ''}`,
    key: `${path.toLowerCase()}?${query}`,
    ttl: path.includes('/rankings/') ? FACEIT_RANKING_TTL_MS : undefined,
    /** Player reads also ask the public site whether this season is still unranked. */
    calibrate: player,
  };
}

/**
 * The Data API keeps the previous season's level and ELO during placements.
 * The public site profile is the one that says the player is still calibrating.
 * A failed lookup leaves the Data API body unchanged.
 */
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
    /* The Twitch account the player linked on FACEIT; only a plain channel name is passed on */
    const twitch = site?.payload?.streaming?.twitch_id;
    if (typeof twitch === 'string' && /^[A-Za-z0-9_]{3,25}$/.test(twitch)) {
      data.twitch_id = twitch;
      changed = true;
    }
    if (changed) return JSON.stringify(data);
  } catch {
    /* the Data API answer still stands */
  }
  return body;
}

export function createFaceitCache({
  now = Date.now,
  fetcher = (...args) => fetch(...args),
  getKey = faceitKey,
  ttl = FACEIT_TTL_MS,
} = {}) {
  const cache = new Map();
  const pending = new Map();
  const remember = (key, entry) => {
    cache.delete(key);
    cache.set(key, entry);
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  };
  const load = (target) => {
    const hit = cache.get(target.key);
    if (hit && now() - hit.at < (target.ttl ?? ttl)) return Promise.resolve(hit);
    const waiting = pending.get(target.key);
    if (waiting) return waiting;
    const task = (async () => {
      try {
        const response = await fetcher(target.upstream, {
          headers: target.site ? SITE_HEADERS : { Authorization: `Bearer ${getKey()}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        });
        let body = (await response.text()).slice(0, MAX_BODY);
        if (response.status === 200 && target.site) body = activeMatchFrom(body);
        if (response.status === 200 && target.calibrate) body = await withCalibration(body, fetcher);
        const entry = { status: response.status, body, at: now() };
        remember(target.key, entry);
        return entry;
      } catch {
        const entry = { status: 502, body: JSON.stringify({ error: 'faceit_unavailable' }), at: now() };
        remember(target.key, entry);
        return entry;
      }
    })().finally(() => pending.delete(target.key));
    pending.set(target.key, task);
    return task;
  };
  return { load };
}

const shared = createFaceitCache();
const limit = createRateLimiter({ perMinute: 180, blockAfter: { strikes: 8, windowMs: 60_000, blockMs: 60_000 } });

function send(res, status, body, extra = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, max-age=15');
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
