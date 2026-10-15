import { applyOverride, fetchProfileOverride } from './profile_override';

export const API_KEY = import.meta.env.VITE_FACEIT_API_KEY;

/** Pictures a player replaced for the banners; the same lookup serves every place a profile is drawn. */
const withOverride = async <T extends { player_id: string; avatar?: string; cover_image?: string }>(profile: T) =>
  applyOverride(
    profile,
    await fetchProfileOverride(profile.player_id, { storage: typeof sessionStorage === 'undefined' ? undefined : sessionStorage })
  );

export const SAMPLE_PLAYER_ID = '10b53a6d-5fc9-4095-920c-2953cfa62486';

export type VerifiedBadgeType = 'none' | 'verified' | 'gold';

/** Competition ID of official matches */
export const OFFICIAL_COMPETITION_IDS = [
  'f4148ddd-bce8-41b8-9131-ee83afcdd6dd' /* EU Queue */,
  '3aced33b-f21c-450c-91d5-10535164e0ab' /* NA Queue*/,
];

/** Info about player returned by API v4 */
interface V4PlayersResponse {
  player_id: string;
  avatar: string;
  cover_image: string;
  /** Set when the player replaced these pictures for the banners. */
  overridden?: { avatar?: boolean; cover?: boolean };
  nickname: string;
  country: string;
  verified?: boolean;
  memberships?: string[];
  games: {
    cs2?: {
      faceit_elo: number;
      skill_level: number;
      region: string;
    };
  };
}

/** Stats returned by API v4 */
interface V4StatsResponse {
  items: {
    stats: {
      [stat: string]: string | number;
    };
  }[];
}

/** Player ranking returned by API v4 */
interface V4RankingResponse {
  items: {
    player_id: string;
    position: number;
  }[];
}

/**
 * FACEIT player profile.
 */
interface FaceitPlayer {
  id: string;
  username: string;
  banner?: string;
  avatar?: string;
  verifiedBadge: VerifiedBadgeType;
  level?: number;
  elo?: number;
  wins: number;
  ranking: number;
  countryRanking: number;
  region: string;
  country: string;
  losses: number;
  avg: {
    adr: number;
    assists: number;
    mvps: number;
    kr: number;
    kills: number;
    hspercent: number;
    deaths: number;
    kd: number;
    wins: number;
    matches: number;
    winStreak: number;
    entryRate: number;
    utilityDamagePerRound: number;
    flashSuccessRate: number;
  };
}

/** Same-origin read. The server holds the FACEIT key and reuses a player for 15 seconds. */
export function faceitGet(path: string) {
  return fetch(`/api/faceit/v4${path}`, { headers: { Accept: 'application/json' } });
}

export const getVerifiedBadgeType = (profile: {
  verified?: boolean;
  memberships?: string[];
}): VerifiedBadgeType => {
  if (!profile.verified) {
    return 'none';
  }

  const memberships = profile.memberships || [];
  if (memberships.includes('premium')) {
    return 'gold';
  }

  return 'verified';
};

async function getPlayerRankingPosition(
  id: string,
  region: string,
  country?: string
): Promise<number | undefined> {
  const response = await faceitGet(
    `/rankings/games/cs2/regions/${region}/players/${id}${country ? `?country=${country}` : ''}`
  );
  if (response.ok) {
    const data = (await response.json()) as V4RankingResponse;
    const item = data.items.find((i) => i.player_id === id);
    return item ? item.position : undefined;
  } else {
    console.error(
      `Failed to fetch ranking: ${response.status} ${await response.text()}`
    );
    return undefined;
  }
}

export function getPlayerStats(
  id: string,
  matchCount: number,
  startDate: Date,
  onlyOfficial: boolean
): Promise<FaceitPlayer | undefined> {
  return new Promise<FaceitPlayer | undefined>((resolve) => {
    faceitGet('/players/' + id).then(async (response) => {
      if (!response.ok) {
        console.error(await response.text());
        resolve(undefined);
        return;
      }

      const v4PlayersResponse = await withOverride((await response.json()) as V4PlayersResponse);
      if (!v4PlayersResponse.games.cs2) {
        console.error('This player never played CS2 on FACEIT.');
        resolve(undefined);
        return;
      }

      const playerId: string = v4PlayersResponse.player_id;
      const username: string = v4PlayersResponse.nickname;
      const banner: string | undefined = v4PlayersResponse.cover_image;
      const avatar: string | undefined = v4PlayersResponse.avatar;
      const verifiedBadge = getVerifiedBadgeType(v4PlayersResponse);
      const country: string = v4PlayersResponse.country;
      const region: string = v4PlayersResponse.games.cs2?.region || 'EU';
      const level: number = v4PlayersResponse.games.cs2?.skill_level || 1;
      const elo: number = v4PlayersResponse.games.cs2?.faceit_elo || 100;
      let ranking: number | undefined = undefined;
      let countryRanking: number | undefined = undefined;
      let wins: number = 0;
      let losses: number = 0;
      let adr: number = 0;
      let assists: number = 0;
      let mvps: number = 0;
      let kr: number = 0;
      let kills: number = 0;
      let hspercent: number = 0;
      let deaths: number = 0;
      let wrWins: number = 0;
      let kd: number = 0;
      let winStreak = 0;
      let entryRate = 0;
      let utilityDamagePerRound = 0;
      let flashSuccessRate = 0;

      let matchesLength: number = 0;

      const matchStats = await faceitGet(
        `/players/${playerId}/games/cs2/stats?limit=100`
      );

      if (matchStats.ok) {
        /* Average stats from last 20/30 matches */

        const v4StatsResponse = (await matchStats.json()) as V4StatsResponse;
        matchesLength = v4StatsResponse.items.length;
        matchesLength = matchesLength > matchCount ? matchCount : matchesLength;

        let i = 0;
        for (const match of v4StatsResponse.items) {
          const countWins = () => {
            if (
              (match.stats['Match Finished At'] as number) < startDate.getTime()
            )
              return;
            if (match.stats['Result'] === '1') {
              wins++;
            } else if (match.stats['Result'] === '0') {
              losses++;
            }
          };

          if (
            !onlyOfficial ||
            OFFICIAL_COMPETITION_IDS.includes(
              match.stats['Competition Id'] as string
            )
          ) {
            countWins();
          }

          if (i >= matchCount) continue;
          adr += parseFloat(match.stats['ADR'] as string);
          assists += parseInt(match.stats['Assists'] as string);
          mvps += parseInt(match.stats['MVPs'] as string);
          kr += parseFloat(match.stats['K/R Ratio'] as string);
          kills += parseInt(match.stats['Kills'] as string);
          deaths += parseInt(match.stats['Deaths'] as string);
          kd += parseFloat(match.stats['K/D Ratio'] as string);
          hspercent += parseFloat(match.stats['Headshots %'] as string);
          if (match.stats['Result'] === '1') {
            wrWins++;
          }
          i++;
        }
      } else {
        console.error(
          `Failed to fetch match stats: ${matchStats.status} ${await matchStats.text()}`
        );
      }

      const lifetimeStats = await faceitGet(`/players/${playerId}/stats/cs2`);
      if (lifetimeStats.ok) {
        const lifetime = (await lifetimeStats.json()) as {
          lifetime?: Record<string, string | number>;
        };
        const value = (key: string) => Number(lifetime.lifetime?.[key] || 0);
        winStreak = value('Current Win Streak');
        entryRate = value('Entry Success Rate') * 100;
        utilityDamagePerRound = value('Utility Damage per Round');
        flashSuccessRate = value('Flash Success Rate') * 100;
      }

      ranking = await getPlayerRankingPosition(playerId, region);
      countryRanking = await getPlayerRankingPosition(
        playerId,
        region,
        country
      );

      resolve({
        id: playerId,
        avatar,
        banner,
        username,
        verifiedBadge,
        level,
        elo,
        ranking: ranking || 999999,
        countryRanking: countryRanking || 999999,
        region,
        country,
        wins,
        losses,
        avg: {
          adr,
          assists,
          mvps,
          kr,
          kills,
          hspercent,
          deaths,
          wins: wrWins,
          matches: matchesLength,
          kd,
          winStreak,
          entryRate,
          utilityDamagePerRound,
          flashSuccessRate,
        },
      });
    });
  });
}

export function getPlayerID(username: string): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve) => {
    faceitGet('/players?nickname=' + encodeURIComponent(username)).then(async (response) => {
      if (!response.ok) {
        console.error(await response.text());
        resolve(undefined);
        return;
      }
      const v4PlayersResponse = (await response.json()) as V4PlayersResponse;
      resolve(v4PlayersResponse.player_id);
    });
  });
}

export function getPlayerProfile(
  username: string
): Promise<V4PlayersResponse | undefined> {
  return new Promise<V4PlayersResponse | undefined>((resolve) => {
    faceitGet(
      `/players${username.length > 12 ? `/${username}` : `?nickname=${encodeURIComponent(username)}`}`
    ).then(async (response) => {
      if (!response.ok) {
        console.error(await response.text());
        resolve(undefined);
        return;
      }
      resolve(await withOverride((await response.json()) as V4PlayersResponse));
    });
  });
}

const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RosterCard = {
  username: string;
  avatar?: string;
  elo: number;
  level: number;
  kd: number;
  winRate: number;
  /** Lifetime averages and totals; 0 when FACEIT does not send them. */
  hs?: number;
  adr?: number;
  kr?: number;
  matches?: number;
  wins?: number;
  streak?: number;
  missing?: boolean;
};

/** Profile plus lifetime K/D and win rate, for one row of the roster. */
export async function lookupRosterCard(name: string): Promise<RosterCard> {
  const profile = await lookupPlayer(name);
  const game = profile?.games.cs2;
  if (!profile || !game) {
    return { username: name.trim(), elo: 0, level: 1, kd: 0, winRate: 0, hs: 0, adr: 0, kr: 0, matches: 0, wins: 0, streak: 0, missing: true };
  }
  let kd = 0;
  let winRate = 0;
  let more = { hs: 0, adr: 0, kr: 0, matches: 0, wins: 0, streak: 0 };
  try {
    const response = await faceitGet(`/players/${profile.player_id}/stats/cs2`);
    if (response.ok) {
      const body = (await response.json()) as { lifetime?: Record<string, string | number> };
      const stat = (...names: string[]) => {
        for (const name of names) {
          const value = Number(body.lifetime?.[name]);
          if (Number.isFinite(value) && value > 0) return value;
        }
        return 0;
      };
      kd = stat('Average K/D Ratio');
      winRate = stat('Win Rate %');
      more = {
        hs: stat('Average Headshots %'),
        adr: stat('ADR', 'Average Damage per Round'),
        kr: stat('Average K/R Ratio'),
        matches: stat('Matches'),
        wins: stat('Wins'),
        streak: stat('Current Win Streak'),
      };
    }
  } catch {
    /* the row still shows ELO and level */
  }
  return {
    username: profile.nickname,
    avatar: profile.avatar,
    elo: game.faceit_elo,
    level: game.skill_level,
    kd,
    winRate,
    ...more,
  };
}

/** Profile by nickname, or by id when the value is a FACEIT player id. */
export function lookupPlayer(name: string): Promise<V4PlayersResponse | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return Promise.resolve(undefined);
  const path = PLAYER_ID.test(trimmed)
    ? `/players/${trimmed}`
    : `/players?nickname=${encodeURIComponent(trimmed)}`;
  return faceitGet(path).then(async (response) => {
    if (!response.ok) return undefined;
    return withOverride((await response.json()) as V4PlayersResponse);
  });
}
