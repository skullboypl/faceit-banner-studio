/* global fetch, AbortSignal, setTimeout, clearTimeout */
import { redisCall } from './store.mjs';

const LOGIN = /^[a-z0-9_]{3,25}$/;
const DEFAULT_TTL_SECONDS = 5 * 60;
const LIST_KEY = 'fb:kick-live:list';
const LIST_LIMIT = 2000;
const BATCH = 8;

export function kickCacheTtlSeconds() {
  const value = Number(process.env.KICK_LIVE_CACHE_TTL_SECONDS);
  return Number.isFinite(value) && value >= 30 ? Math.floor(value) : DEFAULT_TTL_SECONDS;
}

function readStreamRow(login, row) {
  if (!LOGIN.test(login) || !row || typeof row.state !== 'string' || !Number.isFinite(row.at)) return null;
  const { at, ...status } = row;
  if (status.state === 'unknown') return null;
  return { status, at };
}

export function createRedisKickStore(call = redisCall) {
  const loadList = async () => {
    const raw = await call((redis) => redis.get(LIST_KEY));
    const found = new Map();
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : null;
      const streams = data?.streams;
      if (!streams || typeof streams !== 'object') return found;
      for (const [login, row] of Object.entries(streams)) {
        const parsed = readStreamRow(login, row);
        if (parsed) found.set(login, parsed);
      }
    } catch {
      /* A malformed list is ignored and refreshed from Kick. */
    }
    return found;
  };
  let writing = Promise.resolve();
  return {
    loadList,
    async saveList(entries) {
      if (!entries.length) return;
      const run = writing.then(async () => {
        const ttl = kickCacheTtlSeconds();
        const merged = await loadList().catch(() => new Map());
        for (const [login, status, at] of entries) {
          if (LOGIN.test(login) && status?.state && status.state !== 'unknown' && Number.isFinite(at)) {
            merged.set(login, { status, at });
          }
        }
        const streams = {};
        const fresh = [...merged.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, LIST_LIMIT);
        for (const [login, row] of fresh) streams[login] = { ...row.status, at: row.at };
        if (!Object.keys(streams).length) return;
        await call((redis) => redis.set(LIST_KEY, JSON.stringify({ streams }), 'EX', ttl));
      });
      writing = run.catch(() => undefined);
      await run;
    },
  };
}

export const redisKickStore = createRedisKickStore();

function httpsUrl(value) {
  return typeof value === 'string' && value.startsWith('https://') ? value : '';
}

/** One Kick channel. Unknown is never presented as offline. */
export function readKickChannel(data) {
  if (!data || typeof data !== 'object') return { state: 'unknown' };
  if (data.livestream == null) return { state: 'offline' };
  const live = data.livestream;
  if (typeof live !== 'object') return { state: 'unknown' };
  const thumbnail =
    httpsUrl(live.thumbnail?.url) ||
    httpsUrl(typeof live.thumbnail === 'string' ? live.thumbnail : '');
  const category = Array.isArray(live.categories) ? live.categories[0] : live.category;
  return {
    state: 'live',
    ...(Number.isInteger(live.viewer_count) && live.viewer_count >= 0 ? { viewers: live.viewer_count } : {}),
    ...(typeof live.session_title === 'string' ? { title: live.session_title.slice(0, 160) } : {}),
    ...(typeof category?.name === 'string' ? { game: category.name.slice(0, 80) } : {}),
    ...(thumbnail ? { thumbnail } : {}),
    ...(typeof live.created_at === 'string' ? { startedAt: live.created_at } : {}),
  };
}

export function createKickLookup({
  fetcher = fetch,
  now = Date.now,
  store = redisKickStore,
  cacheTtlMs = () => kickCacheTtlSeconds() * 1000,
} = {}) {
  const cache = new Map();
  const pending = new Map();
  const remember = (login, status, at) => {
    cache.delete(login);
    cache.set(login, { at, status });
    while (cache.size > LIST_LIMIT) cache.delete(cache.keys().next().value);
  };
  return async function lookup(players) {
    const logins = [...new Set(players.map((player) => String(player.kick || '').toLowerCase()).filter((login) => LOGIN.test(login)))];
    const ttl = cacheTtlMs();
    const usable = (entry) => Boolean(entry) && now() - entry.at < ttl;
    const stale = logins.filter((login) => !pending.has(login) && !usable(cache.get(login)));
    if (stale.length) {
      const stored = await store.loadList().catch(() => new Map());
      for (const login of stale) {
        const row = stored.get(login);
        if (row && now() - row.at < ttl) remember(login, row.status, row.at);
      }
    }
    const missing = stale.filter((login) => !usable(cache.get(login)));
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      if (batch.every((login) => pending.has(login))) continue;
      const task = Promise.resolve().then(async () => {
        const save = [];
        const fetchedAt = now();
        await Promise.all(
          batch.map(async (login) => {
            let status = { state: 'unknown' };
            try {
              const response = await fetcher(`https://kick.com/api/v2/channels/${encodeURIComponent(login)}`, {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(5000),
                cache: 'no-store',
                redirect: 'error',
              });
              if (response.status === 404) status = { state: 'missing' };
              else if (response.ok) status = readKickChannel(await response.json());
            } catch {
              /* Unknown is never presented as offline. */
            }
            if (status.state !== 'unknown') save.push([login, status, fetchedAt]);
            remember(login, status, fetchedAt);
            pending.delete(login);
          })
        );
        await store.saveList(save).catch(() => undefined);
      });
      for (const login of batch) pending.set(login, task);
    }
    let timer;
    await Promise.race([
      Promise.all(logins.map((login) => pending.get(login))),
      new Promise((resolve) => {
        timer = setTimeout(resolve, 1000);
      }),
    ]).finally(() => clearTimeout(timer));
    return players.map((player) => {
      if (!player.kick) return player;
      const entry = cache.get(player.kick.toLowerCase());
      const status = entry && now() - entry.at < ttl ? entry.status : { state: 'unknown' };
      return { ...player, kickStatus: status };
    });
  };
}

export const enrichKick = createKickLookup();
