export const API_KEY = import.meta.env.VITE_FACEIT_API_KEY;

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

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_KEY}`,
};

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
  const url = `https://open.faceit.com/data/v4/rankings/games/cs2/regions/${region}/players/${id}${
    country ? `?country=${country}` : ''
  }`;
  const response = await fetch(url, { headers: HEADERS });
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
    fetch('https://open.faceit.com/data/v4/players/' + id, {
      headers: HEADERS,
    }).then(async (response) => {
      if (!response.ok) {
        console.error(await response.text());
        resolve(undefined);
        return;
      }

      const v4PlayersResponse = (await response.json()) as V4PlayersResponse;
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

      const matchStats = await fetch(
        `https://open.faceit.com/data/v4/players/${playerId}/games/cs2/stats?limit=100`,
        {
          headers: HEADERS,
        }
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

      const lifetimeStats = await fetch(
        `https://open.faceit.com/data/v4/players/${playerId}/stats/cs2`,
        { headers: HEADERS }
      );
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
    fetch('https://open.faceit.com/data/v4/players?nickname=' + username, {
      headers: HEADERS,
    }).then(async (response) => {
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
    fetch(
      `https://open.faceit.com/data/v4/players${username.length > 12 ? `/${username}` : `?nickname=${username}`}`,
      {
        headers: HEADERS,
      }
    ).then(async (response) => {
      if (!response.ok) {
        console.error(await response.text());
        resolve(undefined);
        return;
      }
      const v4PlayersResponse = (await response.json()) as V4PlayersResponse;
      resolve(v4PlayersResponse);
    });
  });
}
