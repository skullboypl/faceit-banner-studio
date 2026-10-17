import { averageElo, matchPhase } from '../../../shared/banner-modes.mjs';
import { faceitGet, getPlayerRankingPosition, lookupPlayer } from './faceit_util';

export type PlayerStats = { kills: number; deaths: number; assists: number; adr: number; kd: number; hs: number; mvps: number };

export type RosterPlayer = {
  id?: string;
  nickname: string;
  avatar?: string;
  level: number;
  elo: number;
  /** Regional place when the player is in the top 1000. The level icon becomes the challenger mark. */
  ranking?: number;
  /** Placements are unfinished, so `elo` is the last known value and there is no level. */
  calibrating?: boolean;
  /** ISO 3166-1 alpha-2 from the FACEIT profile, when known. */
  country?: string;
  missing?: boolean;
  /** Filled once the match is over. */
  stats?: PlayerStats;
};

export type MatchSide = {
  name: string;
  players: RosterPlayer[];
  avg: number;
};

export type LiveMatch = {
  id: string;
  phase: 'pre' | 'live' | 'post' | 'idle';
  map?: string;
  score?: [number, number];
  winner?: 'a' | 'b';
  finishedAt?: number;
  sides: [MatchSide, MatchSide];
  me?: PlayerStats;
};

const COUNTRY = /^[a-z]{2}$/i;

function countryCode(value: unknown): string | undefined {
  return typeof value === 'string' && COUNTRY.test(value) ? value.toLowerCase() : undefined;
}

const cardCache = new Map<string, { elo: number; level?: number; ranking?: number; calibrating?: boolean; country?: string; at: number }>();

async function cardFor(id: string) {
  const cached = cardCache.get(id);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached;
  const profile = await lookupPlayer(id);
  const game = profile?.games.cs2;
  const elo = game?.faceit_elo ?? 0;
  const calibrating = game?.is_calibrating === true;
  const level = calibrating ? undefined : game?.skill_level;
  const ranking =
    profile && !calibrating && level === 10
      ? await getPlayerRankingPosition(profile.player_id, game?.region || 'EU')
      : undefined;
  const card = { elo, level, ranking, calibrating, country: countryCode(profile?.country), at: Date.now() };
  if (elo > 0) cardCache.set(id, card);
  return card;
}

function sideFrom(raw: unknown, fallback: string): MatchSide {
  const team = (raw ?? {}) as {
    nickname?: string;
    name?: string;
    players?: unknown[];
    roster?: unknown[];
  };
  const rows = Array.isArray(team.players) ? team.players : Array.isArray(team.roster) ? team.roster : [];
  const players = rows.slice(0, 5).map((row) => {
    const player = row as {
      player_id?: string;
      nickname?: string;
      game_player_name?: string;
      avatar?: string;
      skill_level?: number;
      game_skill_level?: number;
      country?: string;
    };
    return {
      id: player.player_id,
      nickname: player.nickname || player.game_player_name || '—',
      avatar: player.avatar,
      level: Number(player.game_skill_level || player.skill_level || 1),
      elo: 0,
      ...(countryCode(player.country) ? { country: countryCode(player.country) } : {}),
    };
  });
  const nick = team.nickname || team.name || fallback;
  const name = /^team_[ab]$/i.test(nick) ? fallback : nick;
  return { name, players, avg: 0 };
}

function numberAt(source: unknown, key: string) {
  const bag = source as { score?: Record<string, unknown> } | undefined;
  const value = Number(bag?.score?.[key]);
  return Number.isFinite(value) ? value : undefined;
}

async function enrich(match: LiveMatch) {
  const ids = match.sides.flatMap((side) => side.players.map((player) => player.id).filter(Boolean)) as string[];
  const unique = [...new Set(ids)];
  const cards = new Map<string, { elo: number; level?: number; ranking?: number; calibrating?: boolean; country?: string }>();
  for (let index = 0; index < unique.length; index += 4) {
    const slice = unique.slice(index, index + 4);
    const found = await Promise.all(slice.map(async (id) => [id, await cardFor(id)] as const));
    found.forEach(([id, card]) => cards.set(id, card));
  }
  match.sides.forEach((side) => {
    side.players.forEach((player) => {
      const card = player.id ? cards.get(player.id) : undefined;
      if (!card) return;
      if (card.elo) player.elo = card.elo;
      if (card.calibrating) {
        player.calibrating = true;
        player.level = 0;
        player.ranking = undefined;
      } else if (card.level) player.level = card.level;
      if (!card.calibrating && card.ranking) player.ranking = card.ranking;
      if (card.country) player.country = card.country;
    });
    side.avg = averageElo(side.players);
  });
  return match;
}

/** Per-player totals from a FACEIT match stats response (rounds are summed, so a BO3 would add up). */
export function collectStats(stats: unknown): Map<string, PlayerStats> {
  const rounds = (stats as { rounds?: unknown[] } | undefined)?.rounds ?? [];
  const totals = new Map<string, { kills: number; deaths: number; assists: number; mvps: number; hs: number; adr: number }>();
  for (const round of rounds) {
    const teams = (round as { teams?: { players?: unknown[] }[] }).teams ?? [];
    for (const team of teams) {
      for (const row of team.players ?? []) {
        const player = row as { player_id?: string; player_stats?: Record<string, string> };
        if (!player.player_id) continue;
        const bag = player.player_stats ?? {};
        const sum = totals.get(player.player_id) ?? { kills: 0, deaths: 0, assists: 0, mvps: 0, hs: 0, adr: 0 };
        sum.kills += Number(bag.Kills || 0);
        sum.deaths += Number(bag.Deaths || 0);
        sum.assists += Number(bag.Assists || 0);
        sum.mvps += Number(bag.MVPs || 0);
        sum.hs = Number(bag['Headshots %'] || sum.hs || 0);
        sum.adr = Number(bag.ADR || bag['Average Damage per Round'] || sum.adr || 0);
        totals.set(player.player_id, sum);
      }
    }
  }
  const result = new Map<string, PlayerStats>();
  for (const [id, sum] of totals) {
    const kd = sum.deaths > 0 ? Math.round((sum.kills / sum.deaths) * 100) / 100 : sum.kills;
    result.set(id, { kills: sum.kills, deaths: sum.deaths, assists: sum.assists, adr: Math.round(sum.adr), kd, hs: Math.round(sum.hs), mvps: sum.mvps });
  }
  return result;
}

type MatchRef = Record<string, unknown> & { match_id: string };

/** The lobby or running match the player is in right now, if any. */
async function activeMatch(playerId: string): Promise<MatchRef | undefined> {
  try {
    const response = await faceitGet(`/players/${playerId}/active`);
    if (!response.ok) return undefined;
    const body = (await response.json()) as { match_id?: unknown; status?: unknown };
    return typeof body.match_id === 'string' ? { match_id: body.match_id, status: body.status } : undefined;
  } catch {
    return undefined;
  }
}

async function latestFinished(playerId: string): Promise<MatchRef | undefined> {
  const history = await faceitGet(`/players/${playerId}/history?game=cs2&offset=0&limit=1`);
  if (!history.ok) return undefined;
  const body = (await history.json()) as { items?: Record<string, unknown>[] };
  const item = body.items?.[0];
  return item && typeof item.match_id === 'string' ? (item as MatchRef) : undefined;
}

/** How long an idle player's history is trusted before it is looked at again. */
const IDLE_MS = 60_000;
/** A result still without statistics is asked for again on every poll, but only for this long after the match. */
const STATS_WAIT_MS = 5 * 60_000;

type PlayerPolling = {
  /** The last poll found a lobby or a running match, so the next "no match" means it just ended. */
  wasActive: boolean;
  idleAt: number;
  idleItem?: MatchRef;
};
const polling = new Map<string, PlayerPolling>();
/** Lobby and running matches by id and state: their roster does not change inside one state. */
const stateCache = new Map<string, LiveMatch>();
/** Finished matches by id. A result never changes, apart from statistics that FACEIT adds a little later. */
const resultCache = new Map<string, { match: LiveMatch; at: number }>();

function remember<K, V>(map: Map<K, V>, key: K, value: V, limit = 20) {
  map.delete(key);
  map.set(key, value);
  while (map.size > limit) map.delete(map.keys().next().value as K);
}

/**
 * Newest CS2 match for this player: lobby, live, or the result.
 * A popup polls often, so it asks for the little that can have changed: whether a lobby or a match is running (one cheap
 * request), and only when that changes, the match itself. An idle player's history is looked at about once a minute, a
 * finished match is read once, and the moment a running match disappears its result is looked up without waiting.
 */
export async function fetchLatestMatch(playerId: string): Promise<LiveMatch | undefined> {
  if (!playerId) return undefined;
  const memory = polling.get(playerId) ?? { wasActive: false, idleAt: 0 };
  polling.set(playerId, memory);

  /* The Data API history lists only finished matches, so a lobby or a running match comes from the active lookup. */
  const active = await activeMatch(playerId);
  if (active) {
    memory.wasActive = true;
    const state = `${active.match_id}:${String(active.status)}`;
    const known = stateCache.get(state);
    if (known) return known;
    const match = await buildMatch(playerId, active);
    if (match) remember(stateCache, state, match);
    return match;
  }

  const ended = memory.wasActive;
  memory.wasActive = false;
  let item = memory.idleItem;
  if (ended || !item || Date.now() - memory.idleAt >= IDLE_MS) {
    item = (await latestFinished(playerId)) ?? item;
    memory.idleItem = item;
    memory.idleAt = Date.now();
  }
  if (!item) return undefined;

  const cached = resultCache.get(item.match_id);
  if (cached && (cached.match.me || Date.now() - (cached.match.finishedAt ? cached.match.finishedAt * 1000 : cached.at) > STATS_WAIT_MS)) {
    return cached.match;
  }
  const match = await buildMatch(playerId, item);
  if (match) remember(resultCache, item.match_id, { match, at: Date.now() });
  return match;
}

async function buildMatch(playerId: string, item: MatchRef): Promise<LiveMatch | undefined> {
  const detailsResponse = await faceitGet(`/matches/${item.match_id}`);
  const details = detailsResponse.ok ? ((await detailsResponse.json()) as Record<string, unknown>) : item;
  const teams = (details.teams ?? item.teams) as Record<string, unknown> | undefined;
  const results = (details.results ?? item.results) as { winner?: string; score?: Record<string, unknown> } | undefined;
  const voting = details.voting as { map?: { pick?: string[] } } | undefined;
  const phase = matchPhase(String(details.status || item.status || ''));
  if (phase === 'idle') return undefined;

  const left = numberAt(results, 'faction1');
  const right = numberAt(results, 'faction2');
  const match: LiveMatch = {
    id: item.match_id,
    phase,
    map: voting?.map?.pick?.[0]?.replace(/^de_/, ''),
    score: left !== undefined && right !== undefined ? [left, right] : undefined,
    winner: results?.winner === 'faction1' ? 'a' : results?.winner === 'faction2' ? 'b' : undefined,
    finishedAt: Number(details.finished_at || item.finished_at || 0) || undefined,
    sides: [sideFrom(teams?.faction1, 'A'), sideFrom(teams?.faction2, 'B')],
  };

  if (phase === 'post') {
    const stats = await faceitGet(`/matches/${item.match_id}/stats`);
    if (stats.ok) {
      const byPlayer = collectStats(await stats.json());
      match.me = byPlayer.get(playerId);
      match.sides.forEach((side) =>
        side.players.forEach((player) => {
          if (player.id) player.stats = byPlayer.get(player.id);
        })
      );
    }
  }
  return enrich(match);
}
