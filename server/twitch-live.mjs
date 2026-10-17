/* global process, fetch, URL, AbortSignal, setTimeout, clearTimeout */
const LOGIN = /^[a-z0-9_]{3,25}$/;
const TTL = 60_000;

export function twitchConfig() {
  return {
    enabled: process.env.custom_twitch_api === 'true',
    url: process.env.custom_twitch_api_url || 'https://skullboy.pl',
    key: process.env.custom_twitch_api_key || '',
  };
}

/** Shared batches and a separate short cache keep Twitch independent of FACEIT snapshots. */
export function createTwitchLookup({ fetcher = fetch, now = Date.now, config = twitchConfig } = {}) {
  const cache = new Map();
  const pending = new Map();
  return async function lookup(players) {
    const settings = config();
    if (!settings.enabled || !settings.key) return players;
    const logins = [...new Set(players.map((p) => String(p.twitch || '').toLowerCase()).filter((s) => LOGIN.test(s)))];
    const missing = logins.filter((login) => !pending.has(login) && (!cache.has(login) || now() - cache.get(login).at >= TTL));
    for (let i = 0; i < missing.length; i += 100) {
      const batch = missing.slice(i, i + 100);
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
          cache.delete(login);
          cache.set(login, { at: now(), status });
          pending.delete(login);
        }
        while (cache.size > 2000) cache.delete(cache.keys().next().value);
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
      const status = entry && now() - entry.at < TTL ? entry.status : { state: 'unknown' };
      return { ...player, twitchStatus: status };
    });
  };
}

export const enrichTwitch = createTwitchLookup();
