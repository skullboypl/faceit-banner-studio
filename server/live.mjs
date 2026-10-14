const NICK_MAX = 32;
const STYLE_MAX = 24;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanNick(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .trim()
    .slice(0, NICK_MAX);
  if (cleaned.length < 2) return '';
  return cleaned;
}

/** Public fields from a widget heartbeat. A FACEIT player id is enough; the nickname can be filled in later. */
export function sanitizeInfo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nickname = cleanNick(raw.nickname);
  const playerId =
    typeof raw.playerId === 'string' && UUID.test(raw.playerId)
      ? raw.playerId.toLowerCase()
      : '';
  if (!nickname && !playerId) return null;
  const info = {};
  if (nickname) info.nickname = nickname;
  if (playerId) info.playerId = playerId;
  const elo = Number(raw.elo);
  if (Number.isInteger(elo) && elo >= 0 && elo <= 10000) info.elo = elo;
  const level = Number(raw.level);
  if (Number.isInteger(level) && level >= 1 && level <= 10) info.level = level;
  if (typeof raw.country === 'string' && /^[a-z]{2}$/i.test(raw.country))
    info.country = raw.country.toLowerCase();
  if (typeof raw.style === 'string') {
    const style = raw.style.replace(/[^\w-]/g, '').slice(0, STYLE_MAX);
    if (style) info.style = style;
  }
  return info;
}

/** One row per player, highest recent heartbeat, ELO descending. Players without ELO go last. */
export function publicRanking(entries) {
  const byPlayer = new Map();
  for (const entry of entries) {
    const info = entry?.info;
    if (!info?.nickname) continue;
    const key = info.playerId || info.nickname.toLowerCase();
    const prev = byPlayer.get(key);
    if (!prev || entry.lastSeen >= prev.lastSeen)
      byPlayer.set(key, { ...info, lastSeen: entry.lastSeen });
  }
  return [...byPlayer.values()]
    .sort((a, b) => {
      const ae = Number.isInteger(a.elo) ? a.elo : -1;
      const be = Number.isInteger(b.elo) ? b.elo : -1;
      if (be !== ae) return be - ae;
      return a.nickname.localeCompare(b.nickname);
    })
    .map(({ lastSeen, playerId, ...player }) => player);
}

/** Profile metadata changes slowly; live ELO still comes from widget heartbeats. */
export const PROFILE_TTL_MS = 6 * 60 * 60_000;
export const LEGACY_STATS_TTL_MS = 10 * 60_000;
const RETRY_MS = 5 * 60_000;
const STALE_MS = 24 * 60 * 60_000;
const CACHE_LIMIT = 2000;

function faceitKey() {
  return process.env.FACEIT_API_KEY || process.env.VITE_FACEIT_API_KEY || '';
}

/** Shared per-process cache, including negative results and in-flight requests. */
export function createPlayerLookup({
  now = Date.now,
  fetcher = (...args) => fetch(...args),
  getKey = faceitKey,
} = {}) {
  const cache = new Map();
  const pending = new Map();
  let blockedUntil = 0;
  const ttl = (freshStats) =>
    freshStats ? LEGACY_STATS_TTL_MS : PROFILE_TTL_MS;
  const usable = (entry) =>
    entry?.profile && now() - entry.at < STALE_MS ? entry.profile : null;
  const needsRefresh = (id, freshStats = false) => {
    const entry = cache.get(id);
    return (
      !!getKey() &&
      UUID.test(id) &&
      now() >= blockedUntil &&
      !pending.has(id) &&
      (!entry ||
        (now() >= entry.retryAt && now() - entry.at >= ttl(freshStats)))
    );
  };
  const remember = (id, value) => {
    cache.delete(id);
    cache.set(id, value);
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  };
  const lookup = async (rawId, { freshStats = false } = {}) => {
    const id = String(rawId).toLowerCase();
    if (!getKey() || !UUID.test(id)) return null;
    const existing = cache.get(id);
    if (existing && now() - existing.at < ttl(freshStats))
      return usable(existing);
    if (pending.has(id)) return pending.get(id);
    if (!needsRefresh(id, freshStats)) return usable(existing);
    const task = (async () => {
      try {
        const response = await fetcher(
          `https://open.faceit.com/data/v4/players/${id}`,
          {
            headers: {
              Authorization: `Bearer ${getKey()}`,
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(2500),
          }
        );
        if (!response.ok) {
          if ([401, 403, 429].includes(response.status)) {
            const raw = response.headers?.get('retry-after');
            const seconds = raw ? Number(raw) : NaN;
            const delay = Number.isFinite(seconds)
              ? seconds * 1000
              : raw
                ? Date.parse(raw) - now()
                : RETRY_MS;
            blockedUntil =
              now() +
              Math.min(
                60 * 60_000,
                Math.max(RETRY_MS, Number.isFinite(delay) ? delay : RETRY_MS)
              );
          }
          if (response.status === 404) {
            remember(id, {
              profile: null,
              at: now(),
              retryAt: now() + PROFILE_TTL_MS,
            });
            return null;
          }
          throw new Error('profile_unavailable');
        }
        const data = await response.json();
        if (data?.player_id?.toLowerCase() !== id)
          throw new Error('profile_mismatch');
        const profile = sanitizeInfo({
          nickname: data.nickname,
          playerId: id,
          elo: data.games?.cs2?.faceit_elo,
          level: data.games?.cs2?.skill_level,
          country: data.country,
        });
        if (!profile?.nickname) throw new Error('invalid_profile');
        profile.verifiedBadge =
          data.verified === true
            ? Array.isArray(data.memberships) &&
              data.memberships.includes('premium')
              ? 'gold'
              : 'verified'
            : 'none';
        if (
          typeof data.avatar === 'string' &&
          data.avatar.startsWith('https://') &&
          data.avatar.length <= 2048
        )
          profile.avatar = data.avatar;
        remember(id, { profile, at: now(), retryAt: 0 });
        return profile;
      } catch {
        remember(id, {
          profile: usable(existing),
          at: existing?.at ?? -Infinity,
          retryAt: now() + RETRY_MS,
        });
        return usable(existing);
      }
    })().finally(() => pending.delete(id));
    pending.set(id, task);
    return task;
  };
  return { lookup, needsRefresh };
}
const playerLookup = createPlayerLookup();
export const lookupPlayer = playerLookup.lookup;

/** player_id from the banner address. Old widgets never send it in the heartbeat; the browser still puts the page URL in Referer. */
export function playerIdFromReferer(referer) {
  if (typeof referer !== 'string' || !referer) return '';
  try {
    const id = new URL(referer).searchParams.get('player_id') || '';
    return UUID.test(id) ? id.toLowerCase() : '';
  } catch {
    return '';
  }
}

/** Enrich authoritative badges for all players; preserve the latest heartbeat ELO.
 * At most 12 cold/expired profiles per snapshot and 6 simultaneous requests.
 * Warm profiles do not consume the budget, so later snapshots fill the remaining rows.
 */
export async function fillFromPlayerId(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const id = entry?.info?.playerId;
    if (!id) continue;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(entry);
  }
  let budget = 12;
  const work = [...grouped.entries()].filter(([id, rows]) => {
    const freshStats = rows.some(
      ({ info }) =>
        !info.nickname ||
        !Number.isInteger(info.elo) ||
        !Number.isInteger(info.level)
    );
    return !playerLookup.needsRefresh(id, freshStats) || budget-- > 0;
  });
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, work.length) }, async () => {
      while (cursor < work.length) {
        const [id, rows] = work[cursor++];
        const freshStats = rows.some(
          ({ info }) =>
            !info.nickname ||
            !Number.isInteger(info.elo) ||
            !Number.isInteger(info.level)
        );
        const profile = await lookupPlayer(id, { freshStats });
        if (!profile?.nickname) continue;
        for (const entry of rows) {
          entry.info = {
            ...profile,
            ...entry.info,
            nickname: entry.info.nickname || profile.nickname,
            elo: Number.isInteger(entry.info.elo)
              ? entry.info.elo
              : profile.elo,
            level: Number.isInteger(entry.info.level)
              ? entry.info.level
              : profile.level,
            country: entry.info.country || profile.country,
            verifiedBadge: profile.verifiedBadge,
            ...(profile.avatar ? { avatar: profile.avatar } : {}),
          };
        }
      }
    })
  );
}
