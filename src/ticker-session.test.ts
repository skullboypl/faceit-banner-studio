import { afterEach, describe, expect, test, vi } from 'vitest';
import { getPlayerStats, summarizeSessionMatches } from '../widget/src/utils/faceit_util';
import { sessionLine } from '../widget/src/widget/session-line';

const ID = '11111111-1111-4111-8111-111111111111';
const HOUR = 3_600_000;
const start = Date.now() - 2 * HOUR;

const match = (finishedAgoHours: number, kills: number, deaths: number, adr: number, result: '1' | '0') => ({
  stats: {
    'Match Finished At': Date.now() - finishedAgoHours * HOUR,
    Kills: String(kills),
    Deaths: String(deaths),
    Assists: '3',
    MVPs: '2',
    ADR: String(adr),
    'K/D Ratio': (kills / deaths).toFixed(2),
    'K/R Ratio': '0.8',
    'Headshots %': '40',
    Result: result,
    'Competition Id': 'x',
  },
});

function stubFaceit(items: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input).replace('/api/faceit/v4', '');
      const body = url.startsWith(`/players/${ID}/games/cs2/stats`)
        ? { items }
        : url === `/players/${ID}`
          ? { player_id: ID, nickname: 'tester', country: 'pl', games: { cs2: { faceit_elo: 2000, skill_level: 9, region: 'EU' } } }
          : {};
      return Promise.resolve(new Response(JSON.stringify(body), { status: url.startsWith('/rankings') ? 404 : 200 }));
    })
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('session stats: only the matches played since the session started', () => {
  const items = [match(1, 20, 10, 90, '1'), match(0.5, 10, 10, 70, '0'), match(5, 30, 5, 120, '1')];

  test('summarizeSessionMatches also gives the K/D of the session', () => {
    const session = summarizeSessionMatches(items, start);
    expect(session.matches).toBe(2);
    expect(session.kd).toBeCloseTo(1.5, 5);
    expect(session.avg).toBe(15);
    expect(session.adr).toBeCloseTo(80, 5);
  });

  test('getPlayerStats returns them next to the last-30 averages, which still use every match', async () => {
    stubFaceit(items);
    const player = await getPlayerStats(ID, 30, new Date(start), false);
    expect(player?.session?.matches).toBe(2);
    expect(player?.session?.adr).toBeCloseTo(80, 5);
    expect(player?.avg.matches).toBe(3);
    expect(player?.avg.kills).toBe(60);
  });

  test('the official-only filter applies to the session as well', async () => {
    stubFaceit(items);
    const player = await getPlayerStats(ID, 30, new Date(start), true);
    expect(player?.session?.matches).toBe(0);
  });
});

describe('sessionLine', () => {
  test('is kills per match / ADR and K/D of the session', () => {
    const line = sessionLine({ wins: 1, losses: 1, matches: 2, kills: 30, hs: 40, avg: 15, adr: 80, kr: 0.8, winRate: 50, kd: 1.5 });
    expect(line).toEqual({ killsAdr: '15/80', kd: '1.5', kr: '0.8', hs: '40%' });
  });

  test('is empty (not zeros) before the first match of the session', () => {
    expect(sessionLine(undefined)).toEqual({ killsAdr: null, kd: null, kr: null, hs: null });
    expect(sessionLine({ wins: 0, losses: 0, matches: 0, kills: 0, hs: 0, avg: 0, adr: 0, kr: 0, winRate: 0, kd: 0 })).toEqual({
      killsAdr: null,
      kd: null,
      kr: null,
      hs: null,
    });
  });
});
