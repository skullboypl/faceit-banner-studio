import { redisCall } from './store.mjs';

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
    .map(({ lastSeen, playerId, region, ...player }) => {
      const avatar =
        playerId && typeof player.avatar === 'string' && player.avatar.startsWith('https://')
          ? `/api/presence/avatar/${playerId}`
          : player.avatar;
      const ranking =
        Number.isInteger(player.ranking) && player.ranking >= 1 && player.ranking <= 1000
          ? player.ranking
          : undefined;
      const next = { ...player };
      if (avatar) next.avatar = avatar;
      else delete next.avatar;
      if (ranking) next.ranking = ranking;
      else delete next.ranking;
      if (player.confirmed === true) next.confirmed = true;
      else delete next.confirmed;
      return next;
    });
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
        const regionRaw = data.games?.cs2?.region;
        profile.region =
          typeof regionRaw === 'string' && /^[A-Za-z0-9_-]{2,8}$/.test(regionRaw) ? regionRaw : 'EU';
        if (
          typeof data.avatar === 'string' &&
          data.avatar.startsWith('https://') &&
          data.avatar.length <= 2048 &&
          avatarAllowed(data.avatar)
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

const AVATAR_HOSTS = new Set([
  'assets.faceit-cdn.net',
  'distribution.faceit-cdn.net',
  'cdn.faceit.com',
  'cdn-frontend.faceit.com',
]);
const AVATAR_TTL_SECONDS = 6 * 60 * 60;
const AVATAR_MISS_MS = 10 * 60_000;
const RANK_TTL_SECONDS = 6 * 60 * 60;
const avatarMemory = new Map();
const rankMemory = new Map();

/** FACEIT-owned image hosts only, so the avatar route cannot fetch an arbitrary URL. */
export function avatarAllowed(value) {
  try {
    const host = new URL(value).hostname;
    return AVATAR_HOSTS.has(host) || host.endsWith('.faceit-cdn.net') || host.endsWith('.faceit.com');
  } catch {
    return false;
  }
}

export function avatarContentType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 32) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function rememberAvatar(id, image, ttl) {
  avatarMemory.set(id, { image, at: Date.now(), ttl });
  while (avatarMemory.size > 500) avatarMemory.delete(avatarMemory.keys().next().value);
}

/** Downloads a known player's FACEIT avatar once and keeps it for the browser to reuse. */
export async function loadAvatar(playerId) {
  const id = String(playerId || '').toLowerCase();
  if (!UUID.test(id)) return null;
  const local = avatarMemory.get(id);
  if (local && Date.now() - local.at < local.ttl) return local.image;
  const packed = await redisCall((redis) => redis.getBuffer(`fb:avatar:${id}`));
  const packedType = avatarContentType(packed);
  if (packedType) {
    const image = { body: packed, type: packedType };
    rememberAvatar(id, image, AVATAR_TTL_SECONDS * 1000);
    return image;
  }
  const profile = await lookupPlayer(id);
  if (!profile?.avatar || !avatarAllowed(profile.avatar)) {
    rememberAvatar(id, null, AVATAR_MISS_MS);
    return null;
  }
  try {
    const response = await fetch(profile.avatar, { signal: AbortSignal.timeout(4000), redirect: 'follow' });
    if (!response.ok || !avatarAllowed(response.url || profile.avatar)) throw new Error('avatar');
    const body = Buffer.from(await response.arrayBuffer());
    const type = avatarContentType(body);
    if (!type || body.length > 512_000) throw new Error('avatar');
    const image = { body, type };
    rememberAvatar(id, image, AVATAR_TTL_SECONDS * 1000);
    await redisCall((redis) => redis.set(`fb:avatar:${id}`, body, 'EX', AVATAR_TTL_SECONDS));
    return image;
  } catch {
    rememberAvatar(id, null, AVATAR_MISS_MS);
    return null;
  }
}

function rankingPosition(data, id) {
  const direct = Number(data?.position);
  if (Number.isInteger(direct) && direct >= 1) return direct;
  const item = Array.isArray(data?.items)
    ? data.items.find((row) => String(row?.player_id || '').toLowerCase() === id)
    : null;
  const position = Number(item?.position);
  return Number.isInteger(position) && position >= 1 ? position : null;
}

/** Region place for a level-10 player. Top 1000 is the challenger mark. Cached for six hours. */
export async function lookupRanking(id, region = 'EU') {
  const player = String(id || '').toLowerCase();
  const area = /^[A-Za-z0-9_-]{2,8}$/.test(region) ? region : 'EU';
  if (!UUID.test(player) || !faceitKey()) return null;
  const key = `${player}:${area}`;
  const local = rankMemory.get(key);
  if (local && Date.now() - local.at < RANK_TTL_SECONDS * 1000) return local.position;
  const cached = await redisCall((redis) => redis.get(`fb:rank:${key}`));
  if (typeof cached === 'string') {
    const position = cached ? Number(cached) : null;
    const value = Number.isInteger(position) && position >= 1 ? position : null;
    rankMemory.set(key, { position: value, at: Date.now() });
    return value;
  }
  try {
    const response = await fetch(
      `https://open.faceit.com/data/v4/rankings/games/cs2/regions/${encodeURIComponent(area)}/players/${player}`,
      {
        headers: { Authorization: `Bearer ${faceitKey()}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(2500),
      }
    );
    const position = response.ok ? rankingPosition(await response.json(), player) : null;
    if (response.ok || response.status === 404) {
      rankMemory.set(key, { position, at: Date.now() });
      await redisCall((redis) => redis.set(`fb:rank:${key}`, position ? String(position) : '', 'EX', RANK_TTL_SECONDS));
      return position;
    }
  } catch {
    /* the level icon still renders without the challenger mark */
  }
  rankMemory.set(key, { position: null, at: Date.now() - (RANK_TTL_SECONDS * 1000 - 5 * 60_000) });
  return null;
}

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
        if (profile.level === 10 && !Number.isInteger(profile.ranking)) {
          const ranking = await lookupRanking(id, profile.region);
          if (ranking) profile.ranking = ranking;
        }
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
