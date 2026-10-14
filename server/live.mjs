const NICK_MAX = 32;
const STYLE_MAX = 24;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanNick(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, NICK_MAX);
  if (cleaned.length < 2) return '';
  return cleaned;
}

/** Public fields from a widget heartbeat. Invalid fields are dropped; no nickname means no board row. */
export function sanitizeInfo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nickname = cleanNick(raw.nickname);
  if (!nickname) return null;
  const info = { nickname };
  if (typeof raw.playerId === 'string' && UUID.test(raw.playerId)) info.playerId = raw.playerId.toLowerCase();
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
