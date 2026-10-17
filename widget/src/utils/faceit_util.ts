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
      /** True while this season's placements are unfinished. ELO is then the last known value. */
      is_calibrating?: boolean;
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
  /** The player's own place. 0 means they are off the ladder. */
  position?: number;
  items?: {
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
  /** Placements for the current season are not finished. `elo` is the last known value, and there is no level. */
  calibrating?: boolean;
  wins: number;
  /** Session results, newest first. The same window as `wins` and `losses`. */
  form?: ('W' | 'L')[];
  ranking: number;
  countryRanking: number;
  region: string;
  country: string;
  losses: number;
  /** Averages of only the matches since the session start: the "today" numbers. */
  session?: SessionCard;
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
/**
 * Reads FACEIT through our server, which caches and rate-limits for everyone. When the server cannot answer
 * (rate limited, down, unreachable) and a browser key is configured (VITE_FACEIT_CLIENT_KEY), the browser asks FACEIT
 * itself, so a busy server does not leave a banner empty. That key is meant to be public; it is separate from the server key.
 */
export async function faceitGet(path: string): Promise<Response> {
  const clientKey = import.meta.env.VITE_FACEIT_CLIENT_KEY as string | undefined;
  const direct = () =>
    fetch(`https://open.faceit.com/data/v4${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${clientKey}` },
    });
  try {
    const response = await fetch(`/api/faceit/v4${path}`, { headers: { Accept: 'application/json' } });
    if (!clientKey || (response.status !== 429 && response.status < 500)) return response;
    return await direct().catch(() => response);
  } catch (error) {
    if (!clientKey) throw error;
    return direct();
  }
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

/** Stands in for a place FACEIT did not give (calibrating, outside the list, or a failed lookup); never drawn. */
export const UNKNOWN_PLACE = 999999;

export async function getPlayerRankingPosition(
  id: string,
  region: string,
  country?: string
): Promise<number | undefined> {
  const response = await faceitGet(
    `/rankings/games/cs2/regions/${region}/players/${id}${country ? `?country=${country}` : ''}`
  );
  if (response.ok) {
    const data = (await response.json()) as V4RankingResponse;
    /* Only the regional top 1000 is a challenger place; a place in a country can be any number. */
    const last = country ? Infinity : 1000;
    if (Number.isInteger(data.position) && (data.position as number) >= 1 && (data.position as number) <= last) {
      return data.position;
    }
    const item = data.items?.find((i) => i.player_id === id);
    return item && item.position >= 1 && item.position <= last ? item.position : undefined;
  } else {
    console.error(
      `Failed to fetch ranking: ${response.status} ${await response.text()}`
    );
    return undefined;
  }
}

/**
 * What a banner shows only changes when the player finishes a match: ELO, level, the averages and the session record.
 * The avatar, the cover, the country and the badge change almost never. So a reading is kept (in memory and in
 * localStorage, which OBS keeps between scene switches), and each refresh asks one small question first: what is the
 * newest finished match? Only when the answer changed is the full set read again. A reading is never trusted for more
 * than ten minutes, and for two minutes after a new match every refresh reads in full, because FACEIT updates ELO a little later.
 */
const REUSE_MS = 10 * 60_000;
const SETTLE_MS = 2 * 60_000;
const MEMORY_PREFIX = 'fcw_memo_';

type Reading<T> = { value: T; playerId: string; head: string | null; fetchedAt: number; changedAt: number };
const memory = new Map<string, Reading<unknown>>();

function storedReading<T>(key: string): Reading<T> | undefined {
  const held = memory.get(key) as Reading<T> | undefined;
  if (held) return held;
  try {
    const raw = localStorage.getItem(MEMORY_PREFIX + key);
    const parsed = raw ? (JSON.parse(raw) as Reading<T>) : undefined;
    if (parsed && Date.now() - parsed.fetchedAt < REUSE_MS && typeof parsed.playerId === 'string') {
      memory.set(key, parsed);
      return parsed;
    }
  } catch {
    /* no storage here: the reading just stays in memory */
  }
  return undefined;
}

function keepReading<T>(key: string, reading: Reading<T>) {
  memory.set(key, reading);
  try {
    localStorage.setItem(MEMORY_PREFIX + key, JSON.stringify(reading));
  } catch {
    /* storage full or blocked */
  }
}

/** The newest finished match of a player: one small request. */
async function newestMatch(playerId: string): Promise<string | null> {
  try {
    const response = await faceitGet(`/players/${playerId}/history?game=cs2&offset=0&limit=1`);
    if (!response.ok) return null;
    const body = (await response.json()) as { items?: { match_id?: unknown }[] };
    const id = body.items?.[0]?.match_id;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

async function remembered<T>(
  key: string,
  load: () => Promise<{ value: T; playerId: string } | undefined>
): Promise<T | undefined> {
  const stored = storedReading<T>(key);
  let changedAt = stored?.changedAt ?? 0;
  if (stored && stored.head && Date.now() - stored.fetchedAt < REUSE_MS) {
    const head = await newestMatch(stored.playerId);
    if (head && head === stored.head && Date.now() - changedAt > SETTLE_MS) return stored.value;
    if (head && head !== stored.head) changedAt = Date.now();
  }
  const loaded = await load();
  if (!loaded) return stored?.value;
  const head = await newestMatch(loaded.playerId);
  if (stored?.head && head && stored.head !== head) changedAt = Date.now();
  keepReading(key, { value: loaded.value, playerId: loaded.playerId, head, fetchedAt: Date.now(), changedAt });
  return loaded.value;
}

export function getPlayerStats(
  id: string,
  matchCount: number,
  startDate: Date,
  onlyOfficial: boolean
): Promise<FaceitPlayer | undefined> {
  return remembered(`stats|${id}|${matchCount}|${onlyOfficial}|${startDate.getTime()}`, async () => {
    const value = await loadPlayerStats(id, matchCount, startDate, onlyOfficial);
    return value ? { value, playerId: value.id } : undefined;
  });
}

function loadPlayerStats(
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
      const calibrating = v4PlayersResponse.games.cs2?.is_calibrating === true;
      const level: number = calibrating ? 0 : v4PlayersResponse.games.cs2?.skill_level || 1;
      const elo: number = v4PlayersResponse.games.cs2?.faceit_elo || 100;
      let ranking: number | undefined = undefined;
      let countryRanking: number | undefined = undefined;
      let wins: number = 0;
      let losses: number = 0;
      const sessionForm: ('W' | 'L')[] = [];
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
      let session: SessionCard = { ...EMPTY_SESSION };

      const matchStats = await faceitGet(
        `/players/${playerId}/games/cs2/stats?limit=100`
      );

      if (matchStats.ok) {
        /* Average stats from last 20/30 matches */

        const v4StatsResponse = (await matchStats.json()) as V4StatsResponse;
        matchesLength = v4StatsResponse.items.length;
        matchesLength = matchesLength > matchCount ? matchCount : matchesLength;
        session = summarizeSessionMatches(
          v4StatsResponse.items.filter(
            (match) =>
              !onlyOfficial || OFFICIAL_COMPETITION_IDS.includes(match.stats['Competition Id'] as string)
          ) as MatchRow[],
          startDate.getTime()
        );

        let i = 0;
        for (const match of v4StatsResponse.items) {
          const countWins = () => {
            if (
              (match.stats['Match Finished At'] as number) < startDate.getTime()
            )
              return;
            if (match.stats['Result'] === '1') {
              wins++;
              sessionForm.push('W');
            } else if (match.stats['Result'] === '0') {
              losses++;
              sessionForm.push('L');
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

      if (!calibrating) {
        ranking = await getPlayerRankingPosition(playerId, region);
        countryRanking = await getPlayerRankingPosition(
          playerId,
          region,
          country
        );
      }

      resolve({
        id: playerId,
        avatar,
        banner,
        username,
        verifiedBadge,
        level,
        elo,
        calibrating,
        ranking: ranking || UNKNOWN_PLACE,
        countryRanking: countryRanking || UNKNOWN_PLACE,
        region,
        country,
        wins,
        losses,
        form: sessionForm,
        session,
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
  /** Averages and counts from the recent-match window; 0 when FACEIT sends nothing. */
  hs?: number;
  adr?: number;
  /** Regional place, only when the player is in the top 1000. */
  ranking?: number;
  /** Current season placements are unfinished, so `elo` is the last known value and `level` is 0. */
  calibrating?: boolean;
  kr?: number;
  matches?: number;
  wins?: number;
  losses?: number;
  streak?: number;
  /** Newest match first. */
  form?: ('W' | 'L')[];
  /** Counts from the banner session, the same start the header uses. */
  session?: SessionCard;
  missing?: boolean;
};

export type SessionCard = {
  wins: number;
  losses: number;
  matches: number;
  kills: number;
  hs: number;
  /** Kills per match in the session. */
  avg: number;
  adr: number;
  kr: number;
  winRate: number;
  /** Kills divided by deaths over the session. */
  kd: number;
};

export const EMPTY_SESSION: SessionCard = {
  wins: 0,
  losses: 0,
  matches: 0,
  kills: 0,
  hs: 0,
  avg: 0,
  adr: 0,
  kr: 0,
  winRate: 0,
  kd: 0,
};

type MatchRow = { stats?: Record<string, string | number> };

const asNumber = (value: unknown) => {
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(number) ? number : 0;
};

const markOf = (stats: Record<string, string | number>): 'W' | 'L' | null => {
  const raw = stats.Result ?? stats.result;
  if (raw === 1 || raw === '1') return 'W';
  if (raw === 0 || raw === '0') return 'L';
  return null;
};

/**
 * K/D, win rate, HS%, ADR, K/R, the win streak and the W/L form from the newest matches FACEIT returned.
 * Lifetime totals are not used: a missing match stat stays 0.
 */
export function summarizeRecentMatches(items: MatchRow[], limit: number) {
  const rows = items.slice(0, Math.max(0, limit));
  let kills = 0;
  let deaths = 0;
  let headshots = 0;
  let headshotsKnown = false;
  let headshotSamples = 0;
  let headshotPercent = 0;
  let adr = 0;
  let adrSamples = 0;
  let kr = 0;
  let krSamples = 0;
  let rounds = 0;
  let wins = 0;
  let losses = 0;
  const form: ('W' | 'L')[] = [];
  for (const row of rows) {
    const stats = row.stats ?? {};
    const matchKills = asNumber(stats.Kills);
    const matchDeaths = asNumber(stats.Deaths);
    kills += matchKills;
    deaths += matchDeaths;
    const hs = asNumber(stats.Headshots);
    if ('Headshots' in stats) {
      headshots += hs;
      headshotsKnown = true;
    }
    const hsPercent = asNumber(stats['Headshots %']);
    if (hsPercent > 0) {
      headshotPercent += hsPercent;
      headshotSamples += 1;
    }
    const damage = asNumber(stats.ADR ?? stats['Average Damage per Round']);
    if (damage > 0) {
      adr += damage;
      adrSamples += 1;
    }
    const ratio = asNumber(stats['K/R Ratio']);
    if (ratio > 0) {
      kr += ratio;
      krSamples += 1;
    }
    rounds += asNumber(stats.Rounds);
    const mark = markOf(stats);
    if (mark === 'W') wins += 1;
    if (mark === 'L') losses += 1;
    if (mark) form.push(mark);
  }
  let streak = 0;
  for (const mark of form) {
    if (mark !== 'W') break;
    streak += 1;
  }
  const played = wins + losses;
  return {
    kd: deaths > 0 ? kills / deaths : kills > 0 ? kills : 0,
    winRate: played > 0 ? (wins / played) * 100 : 0,
    hs: headshotsKnown && kills > 0 ? (headshots / kills) * 100 : headshotSamples > 0 ? headshotPercent / headshotSamples : 0,
    adr: adrSamples > 0 ? adr / adrSamples : 0,
    kr: rounds > 0 && kills > 0 ? kills / rounds : krSamples > 0 ? kr / krSamples : 0,
    matches: rows.length,
    wins,
    losses,
    streak,
    form,
  };
}

const emptyRecent = { hs: 0, adr: 0, kr: 0, matches: 0, wins: 0, losses: 0, streak: 0, form: [] as ('W' | 'L')[] };

/** Matches finished at or after the session start. Older rows stay out, even when they are inside the 20/30 window. */
export function summarizeSessionMatches(items: MatchRow[], startMs: number): SessionCard {
  if (!(startMs > 0)) return { ...EMPTY_SESSION };
  const rows = items.filter((row) => {
    const finished = asNumber(row.stats?.['Match Finished At']);
    return finished > 0 && finished >= startMs;
  });
  const recent = summarizeRecentMatches(rows, rows.length);
  const kills = rows.reduce((sum, row) => sum + asNumber(row.stats?.Kills), 0);
  return {
    wins: recent.wins,
    losses: recent.losses,
    matches: recent.matches,
    kills,
    hs: recent.hs,
    avg: recent.matches > 0 ? kills / recent.matches : 0,
    adr: recent.adr,
    kr: recent.kr,
    winRate: recent.winRate,
    kd: recent.kd,
  };
}

/** Profile plus K/D and win rate from the last 20 or 30 matches, for one row of the roster. */
export async function lookupRosterCard(name: string, matchWindow = 20, sessionStart = 0): Promise<RosterCard> {
  const card = await remembered(`row|${name.trim().toLowerCase()}|${matchWindow}|${sessionStart}`, async () => {
    const loaded = await loadRosterCard(name, matchWindow, sessionStart);
    return loaded.card.missing ? undefined : { value: loaded.card, playerId: loaded.playerId };
  });
  return card ?? (await loadRosterCard(name, matchWindow, sessionStart)).card;
}

async function loadRosterCard(
  name: string,
  matchWindow: number,
  sessionStart: number
): Promise<{ card: RosterCard; playerId: string }> {
  const profile = await lookupPlayer(name);
  const game = profile?.games.cs2;
  if (!profile || !game) {
    return { card: { username: name.trim(), elo: 0, level: 1, kd: 0, winRate: 0, ...emptyRecent, missing: true }, playerId: '' };
  }
  const limit = matchWindow === 30 ? 30 : 20;
  let recent = { kd: 0, winRate: 0, ...emptyRecent };
  let session: SessionCard = { ...EMPTY_SESSION };
  try {
    const response = await faceitGet(`/players/${profile.player_id}/games/cs2/stats?limit=100`);
    if (response.ok) {
      const body = (await response.json()) as { items?: MatchRow[] };
      const items = Array.isArray(body.items) ? body.items : [];
      recent = summarizeRecentMatches(items, limit);
      session = summarizeSessionMatches(items, sessionStart);
    }
  } catch {
    /* the row still shows ELO and level */
  }
  const calibrating = game.is_calibrating === true;
  let ranking: number | undefined;
  if (!calibrating && game.skill_level === 10) {
    ranking = await getPlayerRankingPosition(profile.player_id, game.region || 'EU');
  }
  return {
    playerId: profile.player_id,
    card: {
      username: profile.nickname,
      avatar: profile.avatar,
      elo: game.faceit_elo,
      level: calibrating ? 0 : game.skill_level,
      calibrating,
      ranking,
      ...recent,
      session,
    },
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
