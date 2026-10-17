/* global process, fetch, URL, AbortSignal, setTimeout, clearTimeout */
import { redisCall } from './store.mjs';

const LOGIN = /^[a-z0-9_]{3,25}$/;
const DEFAULT_TTL_SECONDS = 5 * 60;
const LIST_KEY = 'fb:twitch-live:list';
const LIST_LIMIT = 2000;

export function twitchCacheTtlSeconds() {
  const value = Number(process.env.TWITCH_LIVE_CACHE_TTL_SECONDS);
  return Number.isFinite(value) && value >= 30 ? Math.floor(value) : DEFAULT_TTL_SECONDS;
}

function readStreamRow(login, row) {
  if (!LOGIN.test(login) || !row || typeof row.state !== 'string' || !Number.isFinite(row.at)) return null;
  const { at, ...status } = row;
  if (status.state === 'unknown') return null;
  return { status, at };
}

/** One Redis list of stream statuses, expired with the stream TTL. A restart reads this instead of Twitch. */
export function createRedisTwitchStore(call = redisCall) {
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
      /* A malformed list is ignored and refreshed from the Twitch service. */
    }
    return found;
  };
  let writing = Promise.resolve();
  return {
    loadList,
    async saveList(entries) {
      if (!entries.length) return;
      const run = writing.then(async () => {
        const ttl = twitchCacheTtlSeconds();
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

export const redisTwitchStore = createRedisTwitchStore();

export function twitchConfig() {
  return {
    enabled: process.env.custom_twitch_api === 'true',
    url: process.env.custom_twitch_api_url || 'https://skullboy.pl',
    key: process.env.custom_twitch_api_key || '',
  };
}

/** Shared batches and a separate short cache keep Twitch independent of FACEIT snapshots. */
export function createTwitchLookup({
  fetcher = fetch,
  now = Date.now,
  config = twitchConfig,
  store = redisTwitchStore,
  cacheTtlMs = () => twitchCacheTtlSeconds() * 1000,
} = {}) {
  const cache = new Map();
  const pending = new Map();
  const remember = (login, status, at) => {
    cache.delete(login);
    cache.set(login, { at, status });
    while (cache.size > LIST_LIMIT) cache.delete(cache.keys().next().value);
  };
  return async function lookup(players) {
    const settings = config();
    if (!settings.enabled || !settings.key) return players;
    const logins = [...new Set(players.map((p) => String(p.twitch || '').toLowerCase()).filter((s) => LOGIN.test(s)))];
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
    for (let i = 0; i < missing.length; i += 100) {
      const batch = missing.slice(i, i + 100);
      if (batch.every((login) => pending.has(login))) continue;
      const task = Promise.resolve().then(async () => {
        let streams;
        try {
          const url = new URL('/api/internal/twitch-live', settings.url);
          const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
          if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('https_required');
          url.searchParams.set('logins', batch.join(','));
          const response = await fetcher(url, {
            headers: { Authorization: `Bearer ${settings.key}` },
            signal: AbortSignal.timeout(10_000), cache: 'no-store', redirect: 'error',
          });
          if (!response.ok) throw new Error('upstream_error');
          const data = await response.json();
          if (data?.ok === true && data.streams && typeof data.streams === 'object') streams = data.streams;
        } catch { /* Unknown is never presented as offline. Retry after the normal TTL. */ }
        const save = [];
        const fetchedAt = now();
        for (const login of batch) {
          const row = streams?.[login];
          let status = { state: 'unknown' };
          if (row?.exists === false) status = { state: 'missing' };
          else if (row && !row.error && row.live === false) status = { state: 'offline' };
          else if (row && !row.error && row.live === true) {
            const thumbnail = typeof row.thumbnail === 'string' && row.thumbnail.startsWith('https://')
              ? row.thumbnail
              : undefined;
            status = {
              state: 'live',
              ...(Number.isInteger(row.viewers) && row.viewers >= 0 ? { viewers: row.viewers } : {}),
              ...(typeof row.title === 'string' ? { title: row.title.slice(0, 160) } : {}),
              ...(typeof row.game === 'string' ? { game: row.game.slice(0, 80) } : {}),
              ...(thumbnail ? { thumbnail } : {}),
              ...(typeof row.startedAt === 'string' ? { startedAt: row.startedAt } : {}),
            };
          }
          if (status.state !== 'unknown') save.push([login, status, fetchedAt]);
          remember(login, status, fetchedAt);
          pending.delete(login);
        }
        await store.saveList(save).catch(() => undefined);
      });
      for (const login of batch) pending.set(login, task);
    }
    // Slow upstream calls continue warming the cache without blocking the public list.
    let timer;
    await Promise.race([
      Promise.all(logins.map((login) => pending.get(login))),
      new Promise((resolve) => { timer = setTimeout(resolve, 1000); }),
    ]).finally(() => clearTimeout(timer));
    return players.map((player) => {
      if (!player.twitch) return player;
      const entry = cache.get(player.twitch.toLowerCase());
      const status = entry && now() - entry.at < ttl ? entry.status : { state: 'unknown' };
      return { ...player, twitchStatus: status };
    });
  };
}

export const enrichTwitch = createTwitchLookup();
