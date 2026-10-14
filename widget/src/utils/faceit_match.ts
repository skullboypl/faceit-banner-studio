import { averageElo, matchPhase } from '../../../shared/banner-modes.mjs';
import { API_KEY, lookupPlayer } from './faceit_util';

export type RosterPlayer = {
  id?: string;
  nickname: string;
  avatar?: string;
  level: number;
  elo: number;
  missing?: boolean;
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
  me?: { kills: number; deaths: number; assists: number; adr: number; kd: number; hs: number; mvps: number };
};

const HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
};

const eloCache = new Map<string, { elo: number; at: number }>();

async function eloFor(id: string) {
  const cached = eloCache.get(id);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.elo;
  const profile = await lookupPlayer(id);
  const elo = profile?.games.cs2?.faceit_elo ?? 0;
  if (elo > 0) eloCache.set(id, { elo, at: Date.now() });
  return elo;
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
    };
    return {
      id: player.player_id,
      nickname: player.nickname || player.game_player_name || '—',
      avatar: player.avatar,
      level: Number(player.game_skill_level || player.skill_level || 1),
      elo: 0,
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
  const elos = new Map<string, number>();
  for (let index = 0; index < unique.length; index += 4) {
    const slice = unique.slice(index, index + 4);
    const found = await Promise.all(slice.map(async (id) => [id, await eloFor(id)] as const));
    found.forEach(([id, elo]) => elos.set(id, elo));
  }
  match.sides.forEach((side) => {
    side.players.forEach((player) => {
      if (player.id && elos.get(player.id)) player.elo = elos.get(player.id) as number;
    });
    side.avg = averageElo(side.players);
  });
  return match;
}

function mine(stats: unknown, playerId: string): LiveMatch['me'] {
  const rounds = (stats as { rounds?: unknown[] } | undefined)?.rounds ?? [];
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let mvps = 0;
  let hs = 0;
  let adr = 0;
  let seen = false;
  for (const round of rounds) {
    const teams = (round as { teams?: { players?: unknown[] }[] }).teams ?? [];
    for (const team of teams) {
      for (const row of team.players ?? []) {
        const player = row as { player_id?: string; player_stats?: Record<string, string> };
        if (player.player_id !== playerId) continue;
        const bag = player.player_stats ?? {};
        kills += Number(bag.Kills || 0);
        deaths += Number(bag.Deaths || 0);
        assists += Number(bag.Assists || 0);
        mvps += Number(bag.MVPs || 0);
        hs = Number(bag['Headshots %'] || hs || 0);
        adr = Number(bag.ADR || bag['Average Damage per Round'] || adr || 0);
        seen = true;
      }
    }
  }
  if (!seen) return undefined;
  const kd = deaths > 0 ? Math.round((kills / deaths) * 100) / 100 : kills;
  return { kills, deaths, assists, adr: Math.round(adr), kd, hs: Math.round(hs), mvps };
}

/** Newest CS2 match for this player: lobby, live, or the result. */
export async function fetchLatestMatch(playerId: string): Promise<LiveMatch | undefined> {
  if (!playerId || !API_KEY) return undefined;
  const history = await fetch(
    `https://open.faceit.com/data/v4/players/${playerId}/history?game=cs2&offset=0&limit=1`,
    { headers: HEADERS }
  );
  if (!history.ok) return undefined;
  const body = (await history.json()) as { items?: Record<string, unknown>[] };
  const item = body.items?.[0];
  if (!item || typeof item.match_id !== 'string') return undefined;

  const detailsResponse = await fetch(`https://open.faceit.com/data/v4/matches/${item.match_id}`, { headers: HEADERS });
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
    const stats = await fetch(`https://open.faceit.com/data/v4/matches/${item.match_id}/stats`, { headers: HEADERS });
    if (stats.ok) match.me = mine(await stats.json(), playerId);
  }
  return enrich(match);
}
