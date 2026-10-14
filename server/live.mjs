const NICK_MAX = 32;
const STYLE_MAX = 24;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanNick(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, NICK_MAX);
  if (cleaned.length < 2) return '';
  return cleaned;
}

/** Public fields from a widget heartbeat. A FACEIT player id is enough; the nickname can be filled in later. */
export function sanitizeInfo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nickname = cleanNick(raw.nickname);
  const playerId = typeof raw.playerId === 'string' && UUID.test(raw.playerId) ? raw.playerId.toLowerCase() : '';
  if (!nickname && !playerId) return null;
  const info = {};
  if (nickname) info.nickname = nickname;
  if (playerId) info.playerId = playerId;
  const elo = Number(raw.elo);
  if (Number.isInteger(elo) && elo >= 0 && elo <= 10000) info.elo = elo;
  const level = Number(raw.level);
  if (Number.isInteger(level) && level >= 1 && level <= 10) info.level = level;
  if (typeof raw.country === 'string' && /^[a-z]{2}$/i.test(raw.country)) info.country = raw.country.toLowerCase();
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
    if (!prev || entry.lastSeen >= prev.lastSeen) byPlayer.set(key, { ...info, lastSeen: entry.lastSeen });
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

const lookupCache = new Map();
const LOOKUP_OK_MS = 10 * 60_000;
const LOOKUP_MISS_MS = 60_000;

function faceitKey() {
  return process.env.FACEIT_API_KEY || process.env.VITE_FACEIT_API_KEY || '';
}

/** Public FACEIT profile for a banner that only reported its player id. */
export async function lookupPlayer(playerId) {
  const key = faceitKey();
  if (!key || !UUID.test(playerId)) return null;
  const cached = lookupCache.get(playerId);
  if (cached && Date.now() - cached.at < (cached.profile ? LOOKUP_OK_MS : LOOKUP_MISS_MS)) return cached.profile;
  try {
    const response = await fetch(`https://open.faceit.com/data/v4/players/${playerId}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      lookupCache.set(playerId, { at: Date.now(), profile: null });
      return null;
    }
    const data = await response.json();
    const cs2 = data?.games?.cs2;
    const profile = sanitizeInfo({
      nickname: data?.nickname,
      playerId: data?.player_id || playerId,
      elo: cs2?.faceit_elo,
      level: cs2?.skill_level,
      country: data?.country,
    });
    lookupCache.set(playerId, { at: Date.now(), profile });
    return profile;
  } catch {
    lookupCache.set(playerId, { at: Date.now(), profile: null });
    return null;
  }
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

/** Older banners send the player id before the nickname. Fill the public profile without replacing fields they already sent. */
export async function fillFromPlayerId(entries) {
  const missing = entries.filter((entry) => entry?.info?.playerId && !entry.info.nickname).slice(0, 80);
  await Promise.all(
    missing.map(async (entry) => {
      const profile = await lookupPlayer(entry.info.playerId);
      if (!profile?.nickname) return;
      entry.info = {
        ...profile,
        ...entry.info,
        nickname: entry.info.nickname || profile.nickname,
        elo: Number.isInteger(entry.info.elo) ? entry.info.elo : profile.elo,
        level: Number.isInteger(entry.info.level) ? entry.info.level : profile.level,
        country: entry.info.country || profile.country,
      };
    })
  );
}
