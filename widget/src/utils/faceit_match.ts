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

const cardCache = new Map<string, { elo: number; level?: number; ranking?: number; at: number }>();

async function cardFor(id: string) {
  const cached = cardCache.get(id);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached;
  const profile = await lookupPlayer(id);
  const game = profile?.games.cs2;
  const elo = game?.faceit_elo ?? 0;
  const level = game?.skill_level;
  const ranking =
    profile && level === 10
      ? await getPlayerRankingPosition(profile.player_id, game?.region || 'EU')
      : undefined;
  const card = { elo, level, ranking, at: Date.now() };
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
  const cards = new Map<string, { elo: number; level?: number; ranking?: number }>();
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
      if (card.level) player.level = card.level;
      if (card.ranking) player.ranking = card.ranking;
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

/** Newest CS2 match for this player: lobby, live, or the result. */
export async function fetchLatestMatch(playerId: string): Promise<LiveMatch | undefined> {
  if (!playerId) return undefined;
  const history = await faceitGet(
    `/players/${playerId}/history?game=cs2&offset=0&limit=1`
  );
  if (!history.ok) return undefined;
  const body = (await history.json()) as { items?: Record<string, unknown>[] };
  const item = body.items?.[0];
  if (!item || typeof item.match_id !== 'string') return undefined;

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
