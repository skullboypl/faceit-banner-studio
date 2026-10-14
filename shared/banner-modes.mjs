export const TEAM_LIMIT = 10;

/** Nicknames from the roster setting, in order, without duplicates, capped at 10. */
export function parseRoster(value) {
  if (typeof value !== 'string') return [];
  const seen = new Set();
  const names = [];
  for (const part of value.split(',')) {
    const name = part.trim().replace(/\s+/g, ' ').slice(0, 30);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= TEAM_LIMIT) break;
  }
  return names;
}

/** Lobby, live game, or the result screen. Anything else stays off the overlay. */
export function matchPhase(status) {
  const value = String(status || '').toUpperCase();
  if (['READY', 'VOTING', 'CONFIGURING', 'SUBSTITUTION', 'CAPTAIN_PICK', 'SCHEDULED'].includes(value)) {
    return 'pre';
  }
  if (value === 'ONGOING') return 'live';
  if (value === 'FINISHED' || value === 'MANUAL_RESULT') return 'post';
  return 'idle';
}

export function averageElo(players) {
  const values = (players || [])
    .map((player) => Number(player?.elo))
    .filter((elo) => Number.isFinite(elo) && elo > 0);
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, elo) => sum + elo, 0) / values.length);
}
